export const arena = "https://arena.alingsas.se";

export const arenaNews = (newsPath: string) => `${arena}${newsPath}`;

export const loginBankIDLandingPage = (baseUrl:string) => baseUrl + "/wa/auth?authmech=tc6wyb5ukmps";

export const authLoginUrl = 'https://idp1.alingsas.se/wa/auth/saml/'

export const samlLoginUrl = 'https://arena.alingsas.se/Shibboleth.sso/SAML2/POST'

export const bankIdOtherDeviceAuthUrl = (bankIdBaseUrl: string) => bankIdBaseUrl + "/mg-local/auth/ccp11/grp/other/ssn";

export const pollStatusUrl = (basePollUrl: string) => basePollUrl + "/mg-local/auth/ccp11/grp/pollstatus";

export const currentUser = 'https://arena.alingsas.se/user';

export const skola24 = 'https://idp.alingsas.se/skolfed/skola24';

export const skola24Absence = 'https://web.skola24.se/api/get/schools/for/absence';

export const skola24Students = 'https://web.skola24.se/api/get/students/for/logged/in/person';

export const skola24Timetables = 'https://web.skola24.se/api/services/skola24/get/personal/timetables'

export const skola24TimetableKey = 'https://web.skola24.se/api/get/timetable/render/key';

export const skola24Timetable = 'https://web.skola24.se/api/render/timetable';

export const skola24Host = 'alingsas-sso.skola24.se';

export const getBaseUrl = (url: string) => {
  var path = url.split( '/' );
  return path[0] + '//' + path[2];
}