const BASE = '/api'

export async function fetchProducts({ search = '', sort = '', category = '' } = {}) {
  const params = new URLSearchParams()
  if (search)   params.set('search', search)
  if (sort)     params.set('sort', sort)
  if (category) params.set('category', category)

  const res = await fetch(`${BASE}/products?${params}`)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export async function fetchProduct(id) {
  const res = await fetch(`${BASE}/products/${id}`)
  if (!res.ok) throw new Error('Product not found')
  return res.json()
}

export async function fetchCategories() {
  const res = await fetch(`${BASE}/products/categories`)
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}
