export const arena = "https://arena.alingsas.se";

export const loginBankIDLandingPage = (baseUrl:string) => baseUrl + "/wa/auth?authmech=tc6wyb5ukmps";

export const authLoginUrl = 'https://idp1.alingsas.se/wa/auth/saml/'

export const samlLoginUrl = 'https://arena.alingsas.se/Shibboleth.sso/SAML2/POST'

export const bankIdAuthUrl = (bankIdBaseUrl: string) => bankIdBaseUrl + "/mg-local/auth/ccp11/grp/other/ssn";

export const pollStatusUrl = (basePollUrl: string) => basePollUrl + "/mg-local/auth/ccp11/grp/pollstatus";

export const currentUser = 'https://arena.alingsas.se/user';

export const getBaseUrl = (url: string) => {
  var path = url.split( '/' );
  return path[0] + '//' + path[2];
}