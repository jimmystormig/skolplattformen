export const arena = 'https://arena.alingsas.se'

export const arenaNews = (newsPath: string) => `${arena}${newsPath}`

export const loginBankIDLandingPage = (baseUrl: string) =>
  baseUrl + '/wa/auth?authmech=tc6wyb5ukmps'

export const authLoginUrl = 'https://idp1.alingsas.se/wa/auth/saml/'

export const samlLoginUrl =
  'https://arena.alingsas.se/Shibboleth.sso/SAML2/POST'

export const bankIdOtherDeviceAuthUrl = (bankIdBaseUrl: string) =>
  bankIdBaseUrl + '/mg-local/auth/ccp11/grp/other/ssn'

export const pollStatusUrl = (basePollUrl: string) =>
  basePollUrl + '/mg-local/auth/ccp11/grp/pollstatus'

export const currentUser = 'https://arena.alingsas.se/user'

export const skola24 = 'https://idp.alingsas.se/skolfed/skola24'

export const skola24Timetables =
  'https://web.skola24.se/api/services/skola24/get/personal/timetables'

export const skola24Host = 'alingsas-sso.skola24.se'

export const skolmaten = (schoolID: string) =>
  `https://skolmaten.se/${schoolID}/`

export const unikumSso = 'https://idp.alingsas.se/skolfed/unikum'

export const unikumStart = 'https://start.unikum.net/unikum/start.html'

export const unikumNotificationsUrl = (startpageUrl: string) =>
  startpageUrl.replace('start.html', 'notifications/notifications.html') +
  '&includeActedOn=false'

export const unikumGuardianNotificationsUrl = (
  nikumBaseUrl: string,
  guardianId: string
) =>
  `${nikumBaseUrl}/unikum/notifications/guardian/${guardianId}/unread/list.ajax?startIndex=0`

export const getBaseUrl = (url: string) => {
  var path = url.split('/')
  return path[0] + '//' + path[2]
}
