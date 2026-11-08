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
    : [['validation_mae', '验证 MAE (°)'], ['joint_mae_deg', '测试 MAE (°)'],
       ['joint_rmse_deg', '测试 RMSE (°)'], ['p95_joint_error_deg', '测试 P95 (°)']];
  const value = (record, field) => field === 'validation_mae'
    ? record.validation?.joint_mae_deg : testMetrics(record)?.[field];
  const best = columns.map(([field]) => {
    const numeric = current.models.map(record => value(record, field)).filter(Number.isFinite);
    return numeric.length ? Math[beam ? 'max' : 'min'](...numeric) : null;
  });
  const head = '<thead><tr><th>模型</th>' + columns.map(([, label]) => `<th>${label}</th>`).join('') +
    '<th>参数</th><th>CPU (ms)</th></tr></thead>';
  const rows = current.models.map(record => {
    const cells = columns.map(([field], index) => {
      const number = value(record, field);
      const shown = Number.isFinite(number) ? (beam ? `${(100 * number).toFixed(2)}%` : number.toFixed(6)) : '—';
      return `<td class="${number === best[index] ? 'best' : ''}">${shown}</td>`;
    }).join('');
    const parameters = Number.isFinite(record.parameters) ? record.parameters.toLocaleString() : '—';
    const latency = record.latency?.mean_ms;
    return `<tr class="${record.model === 'pg' ? 'pg' : ''}"><td>${esc(record.name || record.model)}</td>` +
      cells + `<td>${parameters}</td><td>${Number.isFinite(latency) ? latency.toFixed(3) : '—'}</td></tr>`;
  }).join('');
  $('comparison').innerHTML = head + `<tbody>${rows}</tbody>`;
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
    $('task').textContent = `${data.task} / CURRENT RESULTS`;
    $('description').textContent = data.task === 'BEAM'
      ? '8 帧历史预测下一帧，64 类波束输出。'
      : '5 帧历史预测下一帧方位角与俯仰角。丰都与江南分别训练和评价。';
    $('comparison-title').textContent = `PG 与 ${Math.max(0, data.models.length - 1)} 个 baseline 对比`;
    const postTest = data.task === 'DOA' && data.protocol?.test_used_for_model_subset;
    $('selection-note').hidden = !postTest;
    const shown = data.models.map(record => record.name || record.model).join('、');
    $('selection-note').textContent = postTest
      ? `当前 DOA 仅展示 ${shown}。模型权重按验证集选择；模型展示集合是在查看测试结果后确定的，不是新的盲测。`
      : '';
    $('measurement').textContent = data.measurement;
    $('directory').textContent = data.directory;
    $('protocol').textContent = JSON.stringify({protocol: data.protocol, limitations: data.notes}, null, 2);

    const groups = new Set(['ALL']);
    for (const record of data.models) for (const group of Object.keys(record.groups || {})) groups.add(group);
    $('group').innerHTML = [...groups].map(group => `<option>${esc(group)}</option>`).join('');
    $('group').hidden = groups.size === 1;
    $('model').innerHTML = data.models.map(record =>
      `<option value="${esc(record.model)}">${esc(record.name || record.model)}</option>`).join('');
    $('input').value = '';
    $('prediction').textContent = '等待输入';
    comparisonTable();

    const figures = data.files.filter(name => /\.png$/i.test(name) &&
      /comparison|predictions|cdf|topk|nlos/i.test(name));
    $('figures').innerHTML = figures.map(name =>
      `<a target="_blank" href="${asset(name)}"><img loading="lazy" alt="${esc(name)}" src="${asset(name)}"></a>`).join('') ||
      '<p>此版本未发布结果图。</p>';
    const downloads = data.files.filter(name =>
      ['results.json', 'comparison.csv', 'predictions.csv', 'report.html', 'pg.pt',
       'doa_paper_comparison.xlsx'].includes(name) || /nlos.*\.csv$/i.test(name));
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
$('group').onchange = comparisonTable;
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
