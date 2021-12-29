import * as html from 'node-html-parser'
import { decode } from 'he'

export function extractAuthLoginRequestBody(signatureResponseText: string) {
  const signatureResponseDoc = html.parse(decode(signatureResponseText))
  const signatureResponseTextAreas = signatureResponseDoc.querySelectorAll('textarea')
  const SAMLResponseElem = signatureResponseTextAreas.find(ta => {
    const nameAttr = ta.getAttribute("name")
    return nameAttr === 'SAMLResponse'
  })
  const SAMLResponseText = SAMLResponseElem?.rawText
  const RelayStateElem = signatureResponseTextAreas.find(ta => {
    const nameAttr = ta.getAttribute("name")
    return nameAttr === 'RelayState'
  })
  const RelayStateText = RelayStateElem?.rawText
  return `SAMLResponse=${encodeURIComponent(SAMLResponseText || '')}&RelayState=${encodeURIComponent(RelayStateText || '')}`
}

export function extractSAMLLogin(authLoginResponseText: string) {
  const authLoginDoc = html.parse(decode(authLoginResponseText))
  const inputAttrs = authLoginDoc.querySelectorAll('input').map(i => (i as any).rawAttrs)
  const RelayStateText = extractInputField('RelayState', inputAttrs)
  const SAMLResponseText = extractInputField("SAMLResponse", inputAttrs)
  return `SAMLResponse=${encodeURIComponent(SAMLResponseText || '')}&RelayState=${encodeURIComponent(RelayStateText || '')}`
}

export const extractInputField = (sought: string, attrs: string[]) => {
  // there must be a better way to do this...
  const s = attrs.find(e => e.indexOf(sought) >= 0) || ""
  const v = s.substring(s.indexOf('value="') + 'value="'.length)
  return v.substring(0, v.length - 2)
}