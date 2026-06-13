const enquiryService = {
  submit(payload) {
    return api.post('/enquiries', payload)
  },

  getAll(filters = {}) {
    const query = new URLSearchParams(filters).toString()
    return api.get(`/enquiries${query ? '?' + query : ''}`)
  },

  getById(id) {
    return api.get(`/enquiries/${id}`)
  },

  updateStatus(id, status) {
    return api.patch(`/enquiries/${id}/status`, { status })
  },

  delete(id) {
    return api.del(`/enquiries/${id}`)
  },
}
