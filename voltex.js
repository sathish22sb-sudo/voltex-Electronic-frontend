// ── STATE ─────────────────────────────────────────────────────────────────────
let isLoggedIn = false
let authUser = null
let products = []
let enquiries = []
let editingProductId = null

// Auto-restore session from token stored in localStorage
;(function restoreSession() {
  const token = localStorage.getItem('voltex_token')
  if (!token) return
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    isLoggedIn = true
    authUser = payload
  } catch {
    localStorage.removeItem('voltex_token')
  }
})()

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showPage(name) {
  if (name === 'dashboard' && !isLoggedIn) name = 'login'
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  const pg = document.getElementById('page-' + name)
  if (pg) pg.classList.add('active')
  window.scrollTo(0, 0)
  if (name === 'dashboard') {
    const emailEl = document.getElementById('dash-user-email')
    if (emailEl) emailEl.textContent = authUser?.email || ''
    loadDashboard()
  }
}

function goSection(id) {
  showPage('home')
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60)
}

function showDashTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.dash-nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('dtab-' + tab)?.classList.add('active')
  document.getElementById('dtab-btn-' + tab)?.classList.add('active')
  if (tab === 'enquiries') loadAdminEnquiries()
}

function openDashboard() {
  isLoggedIn ? showPage('dashboard') : showPage('login')
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errEl = document.getElementById('login-error')

  try {
    const result = await api.post('/auth/login', { email, password })
    localStorage.setItem('voltex_token', result.token)
    isLoggedIn = true
    authUser = result.user
    errEl.style.display = 'none'
    showPage('dashboard')
  } catch (e) {
    errEl.style.display = 'block'
    errEl.textContent = '❌ ' + (e.message || 'Invalid credentials')
    document.getElementById('login-password').value = ''
  }
}

function doLogout() {
  localStorage.removeItem('voltex_token')
  isLoggedIn = false
  authUser = null
  showPage('home')
}

function togglePw() {
  const inp = document.getElementById('login-password')
  inp.type = inp.type === 'password' ? 'text' : 'password'
}

// ── LANDING PAGE PRODUCTS ────────────────────────────────────────────────────
async function loadLandingProducts() {
  try {
    products = await productService.getAll({ status: 'active' })
  } catch (e) {
    console.error('Failed to load products:', e)
    products = []
  }
  renderLandingGrid()
}

function renderLandingGrid() {
  const grid = document.getElementById('landing-products-grid')
  if (!grid) return

  if (!products.length) {
    grid.innerHTML = '<p style="color:var(--muted);text-align:center;grid-column:1/-1;padding:3rem">No products available at this time.</p>'
    return
  }

  grid.innerHTML = products.map(p => {
    const imgUrl = p.main_image?.blob_url
    const catId = p.catalogue?.id
    const catStreamUrl = catId
      ? `${CONFIG.BASE_URL}/api/${CONFIG.API_VERSION}/media/${catId}/stream?tenant=${CONFIG.TENANT_ID}`
      : null
    return `
      <div class="product-card">
        ${imgUrl
          ? `<img class="card-img" src="${imgUrl}" alt="${escHtml(p.name)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
             <div class="card-img-placeholder" style="display:none"><span>\u{1F4E6}</span></div>`
          : `<div class="card-img-placeholder"><span>\u{1F4E6}</span></div>`}
        <div class="card-body">
          <div class="card-title">${escHtml(p.name)}</div>
          ${p.sku ? `<div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">SKU: ${escHtml(p.sku)}</div>` : ''}
          <div class="card-desc">${escHtml(p.short_description || '')}</div>
          ${catStreamUrl ? `<div style="margin-top:8px"><a class="btn-sm btn-ghost" href="${catStreamUrl}" target="_blank">View Catalogue</a></div>` : ''}
        </div>
      </div>`
  }).join('')
}

// ── ENQUIRY FORM (public — no login required) ──────────────────────────────────
async function handleEnquiry(e) {
  e.preventDefault()
  const btn = document.getElementById('enq-submit-btn')
  btn.disabled = true

  try {
    await enquiryService.submit({
      full_name: document.getElementById('eq-name').value.trim(),
      company: document.getElementById('eq-company').value.trim() || null,
      phone: document.getElementById('eq-phone').value.trim(),
      email: document.getElementById('eq-email').value.trim(),
      enquiry_type: document.getElementById('eq-type').value || 'General Enquiry',
      message: document.getElementById('eq-msg').value.trim(),
    })
    btn.textContent = '✓ Enquiry Sent!'
    btn.style.background = '#22c55e'
    btn.style.color = '#fff'
    e.target.reset()
    setTimeout(() => {
      btn.textContent = 'Send Enquiry →'
      btn.style.background = ''
      btn.style.color = ''
      btn.disabled = false
    }, 3000)
  } catch (err) {
    alert('Failed to send enquiry: ' + err.message)
    btn.disabled = false
  }
}

// ── DASHBOARD INIT ────────────────────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([loadAdminProducts(), loadAdminEnquiries()])
  renderOverview()
}

// ── ADMIN PRODUCTS ────────────────────────────────────────────────────────────
async function loadAdminProducts() {
  try {
    products = await productService.getAll()
    renderProductsTable()
  } catch (e) {
    console.error('Admin products error:', e)
  }
}

function renderProductsTable() {
  const lbl = document.getElementById('prod-count-lbl')
  if (lbl) lbl.textContent = products.length + ' products'
  const tbody = document.getElementById('products-tbody')
  if (!tbody) return

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:2rem">No products yet. Click “+ Add New Product” to get started.</td></tr>'
    return
  }

  tbody.innerHTML = products.map((p, i) => {
    const imgUrl = p.main_image?.blob_url
    const imgCell = imgUrl
      ? `<img src="${imgUrl}" style="width:52px;height:40px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'"/>`
      : `<span style="font-size:1.5rem">\u{1F4E6}</span>`

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${imgCell}</td>
        <td>
          <strong style="color:var(--white)">${escHtml(p.name)}</strong>
          ${p.sku ? `<br><span style="font-size:.73rem;color:var(--muted)">${escHtml(p.sku)}</span>` : ''}
        </td>
        <td style="font-size:.8rem;color:var(--muted);max-width:160px">${escHtml((p.short_description || '').substring(0, 70))}</td>
        <td><span class="badge ${productStatusBadge(p.status)}">${p.status}</span></td>
        <td style="white-space:nowrap">
          <button class="btn-sm btn-info" onclick="openEditProduct(${p.id})">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>`
  }).join('')
}

// ── PRODUCT MODAL ─────────────────────────────────────────────────────────────
function openAddProduct() {
  editingProductId = null
  document.getElementById('modal-title').textContent = 'Add New Product'
  document.getElementById('save-product-btn').textContent = 'Save Product'
  document.getElementById('product-form').reset()
  document.getElementById('p-status').value = 'draft'
  setSpecsEditor([])
  document.getElementById('modal-overlay').classList.add('open')
}

async function openEditProduct(id) {
  try {
    const p = await productService.getById(id)
    editingProductId = id
    document.getElementById('modal-title').textContent = 'Edit Product'
    document.getElementById('save-product-btn').textContent = 'Update Product'
    document.getElementById('p-name').value = p.name || ''
    document.getElementById('p-sku').value = p.sku || ''
    document.getElementById('p-short-desc').value = p.short_description || ''
    document.getElementById('p-detailed-desc').value = p.detailed_description || ''
    document.getElementById('p-status').value = p.status || 'draft'
    const activeSpecs = (p.specifications || []).filter(s => !s.is_deleted)
    setSpecsEditor(activeSpecs)
    document.getElementById('modal-overlay').classList.add('open')
  } catch (e) {
    alert('Failed to load product: ' + e.message)
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

// Specifications dynamic editor
function setSpecsEditor(specs) {
  const c = document.getElementById('specs-container')
  c.innerHTML = ''
  specs.forEach((s, i) => c.insertAdjacentHTML('beforeend', buildSpecRow(i, s.spec_key, s.spec_value)))
}

function buildSpecRow(i, key, value) {
  return `<div class="spec-row" id="spec-row-${i}">
    <input type="text" placeholder="Key (e.g. Voltage)" value="${escHtml(key || '')}" class="spec-key"
      style="flex:1;background:var(--mid);border:1px solid #3a4455;border-radius:4px;padding:.4rem .6rem;color:var(--offwhite);font-size:.82rem"/>
    <input type="text" placeholder="Value (e.g. 230V AC)" value="${escHtml(value || '')}" class="spec-value"
      style="flex:1;background:var(--mid);border:1px solid #3a4455;border-radius:4px;padding:.4rem .6rem;color:var(--offwhite);font-size:.82rem"/>
    <button type="button" onclick="this.closest('.spec-row').remove()"
      style="background:rgba(239,68,68,.15);color:#ef4444;border:none;border-radius:4px;padding:.4rem .7rem;cursor:pointer;font-size:.85rem;flex-shrink:0">✕</button>
  </div>`
}

function addSpec() {
  const c = document.getElementById('specs-container')
  const i = c.querySelectorAll('.spec-row').length
  c.insertAdjacentHTML('beforeend', buildSpecRow(i, '', ''))
}

function collectSpecs() {
  return [...document.querySelectorAll('#specs-container .spec-row')]
    .map(row => ({
      spec_key: row.querySelector('.spec-key').value.trim(),
      spec_value: row.querySelector('.spec-value').value.trim(),
    }))
    .filter(s => s.spec_key && s.spec_value)
}

async function saveProduct() {
  const name = document.getElementById('p-name').value.trim()
  if (!name) { alert('Product name is required.'); return }

  const form = new FormData()
  form.append('name', name)
  form.append('sku', document.getElementById('p-sku').value.trim())
  form.append('short_description', document.getElementById('p-short-desc').value.trim())
  form.append('detailed_description', document.getElementById('p-detailed-desc').value.trim())
  form.append('status', document.getElementById('p-status').value)
  form.append('specifications', JSON.stringify(collectSpecs()))

  const imgFile = document.getElementById('p-image-file')?.files?.[0]
  const catFile = document.getElementById('p-catalogue-file')?.files?.[0]
  if (imgFile) form.append('image', imgFile)
  if (catFile) form.append('catalogue', catFile)

  const btn = document.getElementById('save-product-btn')
  btn.disabled = true
  btn.textContent = editingProductId ? 'Updating...' : 'Saving...'

  try {
    if (editingProductId) {
      await productService.update(editingProductId, form)
    } else {
      await productService.create(form)
    }
    closeModal()
    await loadAdminProducts()
    renderOverview()
  } catch (e) {
    alert('Failed to save product: ' + e.message)
    btn.disabled = false
    btn.textContent = editingProductId ? 'Update Product' : 'Save Product'
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return
  try {
    await productService.delete(id)
    await loadAdminProducts()
    renderOverview()
  } catch (e) {
    alert('Failed to delete product: ' + e.message)
  }
}

// ── ADMIN ENQUIRIES ────────────────────────────────────────────────────────────
async function loadAdminEnquiries() {
  try {
    const filters = {}
    const status = document.getElementById('filter-status')?.value
    const type = document.getElementById('filter-type')?.value
    if (status) filters.status = status
    if (type) filters.enquiry_type = type
    enquiries = await enquiryService.getAll(filters)
    renderEnquiriesTable()
  } catch (e) {
    console.error('Enquiries load error:', e)
  }
}

function renderEnquiriesTable() {
  const lbl = document.getElementById('enq-count-lbl')
  if (lbl) lbl.textContent = enquiries.length + ' total'
  const tbody = document.getElementById('enquiries-tbody')
  if (!tbody) return

  if (!enquiries.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:2rem">No enquiries found.</td></tr>'
    return
  }

  tbody.innerHTML = enquiries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong style="color:var(--white)">${escHtml(e.full_name)}</strong></td>
      <td style="font-size:.8rem">${escHtml(e.company || '—')}</td>
      <td style="font-size:.8rem">${escHtml(e.phone)}</td>
      <td style="font-size:.78rem">${escHtml(e.email)}</td>
      <td><span class="badge badge-blue" style="font-size:.7rem;white-space:nowrap">${escHtml(e.enquiry_type)}</span></td>
      <td style="max-width:150px;font-size:.78rem;color:var(--muted)">${escHtml((e.message || '').substring(0, 60))}${(e.message?.length > 60) ? '…' : ''}</td>
      <td>
        <select onchange="updateEnquiryStatus(${e.id}, this.value)"
          style="background:var(--dark, #1C2230);border:1px solid #3a4455;border-radius:4px;padding:.25rem .4rem;color:var(--offwhite);font-size:.73rem;cursor:pointer">
          <option value="new" ${e.status === 'new' ? 'selected' : ''}>new</option>
          <option value="in_progress" ${e.status === 'in_progress' ? 'selected' : ''}>in_progress</option>
          <option value="resolved" ${e.status === 'resolved' ? 'selected' : ''}>resolved</option>
          <option value="ignored" ${e.status === 'ignored' ? 'selected' : ''}>ignored</option>
        </select>
      </td>
      <td style="font-size:.73rem;color:var(--muted);white-space:nowrap">${formatDate(e.created_at)}</td>
      <td><button class="btn-sm btn-danger" onclick="deleteEnquiry(${e.id})">Del</button></td>
    </tr>`).join('')
}

async function updateEnquiryStatus(id, status) {
  try {
    await enquiryService.updateStatus(id, status)
    const enq = enquiries.find(e => e.id === id)
    if (enq) enq.status = status
    renderOverview()
  } catch (e) {
    alert('Failed to update status: ' + e.message)
    loadAdminEnquiries()
  }
}

async function deleteEnquiry(id) {
  if (!confirm('Delete this enquiry?')) return
  try {
    await enquiryService.delete(id)
    enquiries = enquiries.filter(e => e.id !== id)
    renderEnquiriesTable()
    renderOverview()
  } catch (e) {
    alert('Failed to delete enquiry: ' + e.message)
  }
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function renderOverview() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val }
  set('ov-total', products.length)
  set('ov-active', products.filter(p => p.status === 'active').length)
  set('ov-enq', enquiries.length)
  set('ov-new-enq', enquiries.filter(e => e.status === 'new').length)

  const tbody = document.getElementById('recent-enq-body')
  if (!tbody) return
  if (!enquiries.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1.5rem">No enquiries yet.</td></tr>'
    return
  }
  tbody.innerHTML = enquiries.slice(0, 5).map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(e.full_name)}</td>
      <td style="font-size:.8rem">${escHtml(e.company || '—')}</td>
      <td><span class="badge badge-blue" style="font-size:.7rem">${escHtml(e.enquiry_type)}</span></td>
      <td style="font-size:.75rem;color:var(--muted)">${formatDate(e.created_at)}</td>
      <td><span class="badge ${statusBadge(e.status)}">${e.status}</span></td>
    </tr>`).join('')
}

// ── PDF CATALOGUE MODAL (local PDF — no backend needed) ────────────────────────
function openPdfModal() {
  ['pdf-name', 'pdf-company', 'pdf-phone', 'pdf-email', 'pdf-city'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = ''
  })
  const pi = document.getElementById('pdf-interest'); if (pi) pi.value = ''
  document.getElementById('pdf-error').style.display = 'none'
  document.getElementById('pdf-modal').classList.add('open')
}

function closePdfModal() { document.getElementById('pdf-modal').classList.remove('open') }

function submitPdfLead() {
  const name = document.getElementById('pdf-name').value.trim()
  const phone = document.getElementById('pdf-phone').value.trim()
  const email = document.getElementById('pdf-email').value.trim()
  if (!name || !phone || !email) { document.getElementById('pdf-error').style.display = 'block'; return }
  document.getElementById('pdf-error').style.display = 'none'
  closePdfModal()
  generatePDF({
    name, phone, email,
    company: document.getElementById('pdf-company').value.trim() || '—',
    city: document.getElementById('pdf-city').value.trim() || '—',
    interest: document.getElementById('pdf-interest').value || 'All Products',
  })
}

function generatePDF(lead) {
  const w = window.open('', '_blank', 'width=900,height=700')
  const rows = products.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${escHtml(p.sku || '—')}</td><td>${escHtml((p.short_description || '').substring(0, 80))}</td></tr>`
  ).join('')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>VoltEx Electricals – Product Catalogue</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#111;padding:2.5rem;font-size:13px}
  header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #F5C200;padding-bottom:1.2rem;margin-bottom:1.5rem}
  .logo{font-size:1.8rem;font-weight:900}.logo span{color:#F5C200}
  h1{font-size:1.3rem;font-weight:700;margin-bottom:.3rem}.sub{font-size:.8rem;color:#666;margin-bottom:1.5rem}
  table{width:100%;border-collapse:collapse;margin-bottom:2rem}
  th{background:#0D0F12;color:#F5C200;padding:.6rem .8rem;text-align:left;font-size:.75rem;text-transform:uppercase}
  td{padding:.6rem .8rem;border-bottom:1px solid #eee;font-size:.8rem}tr:nth-child(even)td{background:#fafafa}
  footer{margin-top:2rem;padding-top:1rem;border-top:2px solid #F5C200;display:flex;justify-content:space-between;font-size:.75rem;color:#888}
  @media print{body{padding:1.5rem}}</style></head><body>
  <header>
    <div class="logo">Volt<span>Ex</span> Electricals</div>
    <div style="text-align:right;font-size:.8rem;color:#555">
      <div>Plot 14, MIDC Phase II, Navi Mumbai – 400 705</div>
      <div>+91 22 4000 1234 &nbsp;|&nbsp; sales@voltexelectricals.in</div>
    </div>
  </header>
  <h1>Product Catalogue</h1>
  <p class="sub">Prepared for: <strong>${escHtml(lead.name)}</strong>${lead.company !== '—' ? ' | ' + escHtml(lead.company) : ''} | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
  <table><thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>
  <footer><div>&copy; 2024 VoltEx Electricals Pvt. Ltd.</div><div>www.voltexelectricals.in</div></footer>
  </body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBadge(s) {
  return { new: 'badge-yellow', in_progress: 'badge-blue', resolved: 'badge-green', ignored: 'badge-red' }[s] || 'badge-yellow'
}

function productStatusBadge(s) {
  return { active: 'badge-green', draft: 'badge-yellow', out_of_stock: 'badge-red', archived: 'badge-red' }[s] || 'badge-yellow'
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── INIT ──────────────────────────────────────────────────────────────────────
loadLandingProducts()
