const $ = id => document.getElementById(id);
let catalog = [], current = null, task = 'BEAM', revision = 0;

const esc = value => String(value ?? '—').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const asset = name => `/api/asset?dataset=${encodeURIComponent(current.key)}&name=${encodeURIComponent(name)}`;

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || response.status);
  return data;
}

function showError(value) {
  $('error').hidden = !value;
  $('error').textContent = value?.message || '';
}

function testMetrics(record) {
  const group = $('group').value;
  return group === 'ALL' ? record.test : (record.groups?.[group] || record.test?.[group] || record.test);
}

function comparisonTable() {
  const beam = current.task === 'BEAM';
  const columns = beam
    ? [['top1', 'Top-1'], ['top3', 'Top-3'], ['top5', 'Top-5']]
    : [['joint_mae_deg', '联合 MAE (°)'], ['joint_rmse_deg', '联合 RMSE (°)'],
       ['hits', '指向达标帧数']];
  const value = (record, field) => testMetrics(record)?.[field];
  const best = columns.map(([field]) => {
    const numeric = current.models.map(record => value(record, field)).filter(Number.isFinite);
    return numeric.length ? Math[beam || field === 'hits' ? 'max' : 'min'](...numeric) : null;
  });
  const head = '<thead><tr><th>模型</th>' + columns.map(([, label]) => `<th>${label}</th>`).join('') +
    '</tr></thead>';
  const rows = current.models.map(record => {
    const cells = columns.map(([field], index) => {
      const number = value(record, field);
      let shown = '—';
      if (Number.isFinite(number)) {
        if (beam) shown = `${(100 * number).toFixed(2)}%`;
        else if (field === 'hits') shown = `${number}/${record.test.samples}`;
        else shown = number.toFixed(4);
      }
      return `<td class="${number === best[index] ? 'best' : ''}">${shown}</td>`;
    }).join('');
    return `<tr class="${record.model === 'pg' ? 'pg' : ''}"><td>${esc(record.name || record.model)}</td>${cells}</tr>`;
  }).join('');
  $('comparison').innerHTML = head + `<tbody>${rows}</tbody>`;
  const sampleCount = current.protocol.subsets?.[$('group').value] ?? current.protocol.split.test;
  const parameters = current.models.find(record => record.model === 'pg')?.parameters;
  $('measurement').textContent = [
    current.measurement,
    `${sampleCount.toLocaleString()} 个测试窗口。`,
    Number.isFinite(parameters) ? `PG-MinGRU 回归模型仅有 ${parameters.toLocaleString()} 个可训练参数。` : '',
    ...(current.notes || []),
  ].join(' ');
}

function comparisonFigure() {
  const group = $('group').value;
  const suffix = group === 'ALL' ? '' : `_${group.toLowerCase()}`;
  const name = current.task === 'BEAM' ? `beam_comparison${suffix}.png` : 'direction_comparison.png';
  $('figures').innerHTML = current.files.includes(name)
    ? `<a target="_blank" rel="noopener" href="${asset(name)}"><img alt="${esc(`${current.title} ${group} 模型对比图`)}" src="${asset(name)}"></a>`
    : '<p>此子集未发布结果图。</p>';
}

function inferenceChoices(models) {
  const options = records => records.map(record =>
    `<option value="${esc(record.model)}">${esc(record.name || record.model)}</option>`).join('');
  const active = models.filter(record => !record.archived);
  const archived = models.filter(record => record.archived);
  $('model').innerHTML = options(active) + (archived.length
    ? `<optgroup label="历史模型演示">${options(archived)}</optgroup>` : '');
  if (active.some(record => record.model === 'pg')) $('model').value = 'pg';
  $('sample').disabled = $('predict').disabled = !models.length;
}

async function load() {
  const version = ++revision;
  try {
    showError(null);
    const dataset = $('dataset').value;
    const data = await api(`/api/summary?dataset=${encodeURIComponent(dataset)}`);
    if (version !== revision) return;
    current = data;
    $('title').textContent = data.title;
    $('task').textContent = `${data.task} / VERSION 7`;
    $('description').textContent = data.task === 'BEAM'
      ? '8 帧历史预测下一帧，64 类波束输出。'
      : '5 帧历史预测下一帧方位角与俯仰角。丰都与江南分别训练和评价。';
    $('comparison-title').textContent = `PG 与 ${Math.max(0, data.models.length - 1)} 个 baseline 对比`;
    $('directory').textContent = data.directory;
    $('protocol').textContent = JSON.stringify({protocol: data.protocol, limitations: data.notes}, null, 2);

    const groups = new Set(['ALL']);
    for (const record of data.models) for (const group of Object.keys(record.groups || {})) groups.add(group);
    $('group').innerHTML = [...groups].map(group =>
      `<option value="${esc(group)}">${group === 'ALL' ? '总体' : esc(group)}</option>`).join('');
    $('group').hidden = groups.size === 1;
    inferenceChoices(data.inference_models);
    $('input').value = '';
    $('prediction').textContent = '等待输入';
    comparisonTable();
    comparisonFigure();

    const downloads = data.files.filter(name => ['results.json', 'comparison.csv'].includes(name));
    $('downloads').innerHTML = downloads.map(name =>
      `<a href="${asset(name)}" download>${esc(name)}</a>`).join('');
  } catch (err) {
    showError(err);
  }
}

function chooseTask() {
  const options = catalog.filter(entry => entry.task === task);
  $('dataset').innerHTML = options.map(entry => `<option value="${esc(entry.key)}">${esc(entry.title)}</option>`).join('');
  document.querySelectorAll('[data-task]').forEach(button =>
    button.classList.toggle('active', button.dataset.task === task));
  load();
}

document.querySelectorAll('[data-task]').forEach(button => button.onclick = () => {
  task = button.dataset.task;
  chooseTask();
});
$('dataset').onchange = load;
$('refresh').onclick = load;
$('group').onchange = () => { comparisonTable(); comparisonFigure(); };
$('sample').onclick = async () => {
  try {
    showError(null);
    $('input').value = JSON.stringify(await api(`/api/sample?dataset=${encodeURIComponent(current.key)}&model=${encodeURIComponent($('model').value)}`), null, 2);
  } catch (err) { showError(err); }
};
$('predict').onclick = async () => {
  const button = $('predict');
  button.disabled = true;
  try {
    showError(null);
    const payload = JSON.parse($('input').value);
    if (payload.dataset !== current.key || payload.model !== $('model').value)
      throw Error('输入的数据集或模型与当前选择不一致，请重新载入样例。');
    $('prediction').textContent = JSON.stringify(await api('/api/predict', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    }), null, 2);
  } catch (err) { showError(err); }
  finally { button.disabled = false; }
};

api('/api/datasets').then(data => { catalog = data; chooseTask(); }).catch(showError);
