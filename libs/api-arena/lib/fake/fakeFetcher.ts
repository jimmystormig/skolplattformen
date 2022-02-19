import { Fetcher, Response } from '@skolplattformen/api'
import { alingsasSchoolyearCalendar } from './alingsas-schoolyear-calendar'
import { arenaCurrentUser } from './arena-current-user'
import { arenaStart } from './arena-start'
import { skola24AlingsasSamlAuth } from './skola24-alingsas-saml-auth'
import { skola24Login } from './skola24-login'
import { skola24LoginNovaSSO } from './skola24-login-nova-sso'
import { skola24NovaSamlAuth } from './skola24-nova-saml-auth'
import { skola24Start } from './skola24-start'
import { skola24Timetables } from './skola24-timetables'
import { sodexoStart } from './sodexo-start'
import { unikumChild } from './unikum-child'
import { unikumGuardianNotifications } from './unikum-guardian-notifications'
import { unikumNotifications } from './unikum-notifications'
import { unikumStart } from './unikum-start'

const fetchMappings: { [name: string]: () => Response } = {
  'alingsas-schoolyear-calendar': alingsasSchoolyearCalendar,
  'arena-current-user': arenaCurrentUser,
  'arena-start': arenaStart,
  'sodexo-start': sodexoStart,
  'skola24-alingsas-saml-auth': skola24AlingsasSamlAuth,
  'skola24-nova-saml-auth': skola24NovaSamlAuth,
  'skola24-timetables': skola24Timetables,
  'skola24-start': skola24Start,
  'skola24-login': skola24Login,
  'skola24-login-nova-sso': skola24LoginNovaSSO,
  'unikum-notifications': unikumNotifications,
  'unikum-child': unikumChild,
  'unikum-guardian-notifications': unikumGuardianNotifications,
  'unikum-start': unikumStart,
}

export const fakeFetcher: Fetcher = (
  name: string,
  url: string,
  init?: any
): Promise<Response> => {
  const responder =
    fetchMappings[name] ??
    (() => {
      throw new Error('Request not faked for name: ' + name)
    })
  return Promise.resolve(responder())
}
