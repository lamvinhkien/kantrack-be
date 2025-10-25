export const pagingSkipValue = (page, itemsPerPage) => {
  const p = Number(page)
  const i = Number(itemsPerPage)
  if (isNaN(p) || isNaN(i) || p <= 0 || i <= 0) return 0
  return (p - 1) * i
}
