const _request = async (method, path, body = null, isFormData = false) => {
  const headers = {
    'x-tenant-id': CONFIG.TENANT_ID,
  }

  const token = localStorage.getItem('voltex_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const options = { method, headers }
  if (body) options.body = isFormData ? body : JSON.stringify(body)

  const res = await fetch(
    `${CONFIG.BASE_URL}/api/${CONFIG.API_VERSION}${path}`,
    options
  )

  const data = await res.json()
  if (!res.ok) {
    const message = data.error?.errorMessage || 'Request failed'
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data.data
}

const api = {
  get: (path) => _request('GET', path),
  post: (path, body) => _request('POST', path, body),
  put: (path, body) => _request('PUT', path, body),
  patch: (path, body) => _request('PATCH', path, body),
  del: (path) => _request('DELETE', path),
  postForm: (path, formData) => _request('POST', path, formData, true),
  putForm: (path, formData) => _request('PUT', path, formData, true),
}
