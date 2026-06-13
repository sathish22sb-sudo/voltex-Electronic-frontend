const productService = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString()
    return api.get(`/products${query ? '?' + query : ''}`)
  },

  getById(id) {
    return api.get(`/products/${id}`)
  },

  create(formData) {
    return api.postForm('/products', formData)
  },

  update(id, formData) {
    return api.putForm(`/products/${id}`, formData)
  },

  delete(id) {
    return api.del(`/products/${id}`)
  },
}
