export const getToken = () => sessionStorage.getItem('speechHero.csrf') || ''
export const setToken = (token: string) => sessionStorage.setItem('speechHero.csrf', token)
export const clearToken = () => sessionStorage.removeItem('speechHero.csrf')
