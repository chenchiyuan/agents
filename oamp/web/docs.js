// web/docs.js — 在线接口文档页（0016 / F03 / architecture §5.2 / §6.2 / §6.7）
// 数据源：页面加载时 fetch('/api/docs')（请求时从路由表投影）—— 页面不含登记之外的任何接口路径（F03 验收 6）。
// 只渲染字段级结构视图：不渲染响应示例、不复制 API.md 的叙述与示例（F03 验收 4 / F08 验收 5；示例职责归 API.md）。

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 参数表与请求体字段表共用的五列（名称·位置·类型·是否必填·说明；§6.2）。 */
function fieldsTable(fields) {
  if (fields.length === 0) return '<p class="prose">（无）</p>';
  const rows = fields
    .map(
      (f) =>
        `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${escapeHtml(f.in)}</td><td>${escapeHtml(f.type)}</td><td>${
          f.required ? '是' : '否'
        }</td><td>${escapeHtml(f.desc)}</td></tr>`,
    )
    .join('');
  return `<table class="api-table"><thead><tr><th>名称</th><th>位置</th><th>类型</th><th>必填</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** 逐接口区块：方法+路径 → 说明 → 参数 → 请求体字段 → 响应形态 → 错误码 → API.md 链接（§6.2 / §6.7）。 */
function renderRoute(route) {
  const params = route.params.filter((p) => p.in !== 'body');
  const body = route.params.filter((p) => p.in === 'body');
  // 错误码只渲染码名，不引入「码 → 状态码」的第二份映射（§6.2）；空 → （无）
  const errors = route.errors.length === 0 ? '（无）' : route.errors.map((e) => escapeHtml(e)).join('、');
  return `<section class="route-card">
    <h2><span class="method-badge method-${route.method.toLowerCase()}">${escapeHtml(route.method)}</span><code class="route-path">${escapeHtml(route.path)}</code></h2>
    <p class="prose">${escapeHtml(route.summary)}</p>
    <h3>参数</h3>${fieldsTable(params)}
    <h3>请求体字段</h3>${fieldsTable(body)}
    <h3>响应形态</h3><p class="prose">${escapeHtml(route.response)}</p>
    <h3>错误码</h3><p class="prose">${errors}</p>
    <p class="prose">契约文档：<a href="${escapeHtml(route.docLink)}">API.md</a></p>
  </section>`;
}

(async () => {
  const box = $('routes');
  try {
    const res = await fetch('/api/docs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { routes } = await res.json();
    box.innerHTML = routes.map(renderRoute).join('');
  } catch (err) {
    box.innerHTML = `<p class="prose">接口元数据加载失败：${escapeHtml(err.message)}</p>`;
  }
})();
