export const getToken = () => sessionStorage.getItem('speechHero.token') || ''
export const setToken = (token: string) => sessionStorage.setItem('speechHero.token', token)
export const clearToken = () => sessionStorage.removeItem('speechHero.token')
