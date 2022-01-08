import * as html from 'node-html-parser'
import { decode } from 'he'

export const extractSamlAuthResponseForm = (
  alingsasSamlAuthResponseText: string
) => {
  const doc = html.parse(decode(alingsasSamlAuthResponseText))
  const form = doc.querySelector('form')
  const action = form?.getAttribute('action') || ''
  const samlResponse =
    doc.querySelector('input[name="SAMLResponse"]')?.getAttribute('value') || ''
  const relayState =
    doc.querySelector('input[name="RelayState"]')?.getAttribute('value') || ''
  return {
    action,
    samlResponse,
    relayState,
  }
}

export const getBaseUrl = (url: string) => {
  var path = url.split('/')
  return path[0] + '//' + path[2]
}
