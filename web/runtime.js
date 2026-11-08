'use strict';
const byId = id => document.getElementById(id);
let entries = [], selection = null;
const escapeText = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
  return data;
}

function selectDataset() {
  selection = entries.find(entry => entry.key === byId('dataset').value);
  byId('title').textContent = selection.title;
  byId('contract').textContent = selection.task === 'BEAM'
    ? '8帧历史 · 64类候选波束 · PG-MinGRU'
    : '5帧历史 · 方位角与俯仰角 · PG-MinGRU';
  byId('output').hidden = true;
  byId('error').hidden = true;
  byId('status').textContent = '就绪';
  byId('status').dataset.state = 'ready';
  byId('run').textContent = '载入并运行';
}

function chart(title, history, prediction, beam = false) {
  if (!history.length || ![...history, prediction].every(Number.isFinite))
    throw Error('曲线数据必须为有限数值');
  const n = history.length, width = 480, height = 148;
  const left = 53, right = 14, top = 27, bottom = 27;
  let low = Math.min(...history, prediction), high = Math.max(...history, prediction);
  const pad = Math.max((high - low) * .16, .03);
  low -= pad; high += pad;
  if (beam) {
    low = Math.max(0, Math.floor(low)); high = Math.min(63, Math.ceil(high));
    if (high-low < 2) { low = Math.max(0, low-1); high = Math.min(63, high+1); }
  }
  const px = index => left + index * (width-left-right) / n;
  const py = value => top + (high-value) * (height-top-bottom) / (high-low);
  const tickLabel = value => beam ? Math.round(value) : value.toFixed(high-low < 1 ? 2 : 1);
  const ticks = [low, (low+high)/2, high].map(value =>
    `<line x1="${left}" x2="${width-right}" y1="${py(value)}" y2="${py(value)}" stroke="#e2e9ed"/>
     <text x="${left-7}" y="${py(value)+4}" text-anchor="end" font-size="13" fill="#576d79">${tickLabel(value)}</text>`).join('');
  const xlabels = Array.from({length:n+1}, (_,i) => {
    const label = i === n ? 't+1' : i === n-1 ? 't' : `t-${n-1-i}`;
    return `<text x="${px(i)}" y="${height-8}" text-anchor="middle" font-size="13" fill="#576d79">${label}</text>`;
  }).join('');
  const line = history.map((value,index) => `${px(index)},${py(value)}`).join(' ');
  const points = history.map((value,index) =>
    `<circle cx="${px(index)}" cy="${py(value)}" r="2.7" fill="#416c8b"/>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeText(title)}历史与预测曲线">
    <text x="12" y="16" font-size="14" font-weight="600" fill="#304f61">${escapeText(title)}</text>
    <rect x="${px(n)-17}" y="${top-1}" width="34" height="${height-top-bottom+2}" fill="#edf8f4"/>
    ${ticks}<polyline points="${line}" fill="none" stroke="#416c8b" stroke-width="1.8"/>
    ${points}<line x1="${px(n-1)}" y1="${py(history[n-1])}" x2="${px(n)}" y2="${py(prediction)}" stroke="#0c8c78" stroke-width="2" stroke-dasharray="4 3"/>
    <circle cx="${px(n)}" cy="${py(prediction)}" r="4.2" fill="#0c8c78" stroke="white" stroke-width="1"/>
    ${xlabels}</svg></div>`;
}

function drawResult(input, result) {
  if (selection.task === 'BEAM') {
    const beams = result.top5_beams_zero_based?.[0];
    if (!Array.isArray(beams) || beams.length !== 5) throw Error('缺少前5候选束输出');
    byId('values').className = 'beam-values';
    byId('values').innerHTML = beams.map((beam,index) =>
      `<div class="value-card"><span>候选${index+1}</span><strong>${escapeText(beam)}</strong></div>`).join('');
    const history = input.x[0].map(frame => {
      const powers = frame.slice(0,64);
      return powers.indexOf(Math.max(...powers));
    });
    byId('plots').innerHTML = chart('历史最大功率束 / 下一帧首选束', history, beams[0], true);
    byId('contract').textContent = `${history.length}帧历史 · 64类波束 · 候选按模型分数排序`;
  } else {
    const angles = result.angles_deg?.[0];
    if (!Array.isArray(angles) || angles.length !== 2 || !angles.every(Number.isFinite))
      throw Error('缺少有效双角度输出');
    const history = input.history[0];
    const azimuth = history.map(frame => (Math.atan2(frame[4],frame[5])*180/Math.PI+360)%360);
    const elevation = history.map(frame => Math.atan2(frame[2],Math.hypot(frame[0],frame[1]))*180/Math.PI);
    // Match the shortest azimuth path when crossing the 0/360-degree boundary.
    const localAzimuth = azimuth.map(value => angles[0] + ((value-angles[0]+540)%360-180));
    byId('values').className = 'angle-values';
    byId('values').innerHTML = ['方位角','俯仰角'].map((name,index) =>
      `<div class="value-card"><span>${name}</span><strong>${angles[index].toFixed(4)}°</strong></div>`).join('');
    byId('plots').innerHTML = chart('方位角 (°)', localAzimuth, angles[0]) +
      chart('俯仰角 (°)', elevation, angles[1]);
    byId('contract').textContent = `${history.length}帧历史 · 下一帧双角度 · PG-MinGRU`;
  }
  byId('output').hidden = false;
}

async function runModel() {
  const button = byId('run');
  button.disabled = true; byId('dataset').disabled = true;
  byId('status').textContent = '正在运行'; byId('status').dataset.state = 'running';
  byId('error').hidden = true;
  try {
    const input = await request(`/api/sample?dataset=${encodeURIComponent(selection.key)}&model=pg`);
    const result = await request('/api/predict', {method:'POST',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify(input)});
    drawResult(input, result);
    byId('status').textContent = '运行完成'; byId('status').dataset.state = 'complete';
    button.textContent = '重新运行';
  } catch (error) {
    byId('output').hidden = true;
    byId('status').textContent = '运行失败'; byId('status').dataset.state = 'error';
    byId('error').hidden = false; byId('error').textContent = error.message;
  } finally { button.disabled = false; byId('dataset').disabled = false; }
}

byId('dataset').addEventListener('change',selectDataset);
byId('run').addEventListener('click',runModel);
request('/api/datasets').then(data => {
  entries = data;
  byId('dataset').innerHTML = data.map(entry =>
    `<option value="${escapeText(entry.key)}">${escapeText(entry.title)}</option>`).join('');
  selectDataset(); byId('run').disabled = false;
}).catch(error => { byId('error').hidden=false; byId('error').textContent=error.message; });
