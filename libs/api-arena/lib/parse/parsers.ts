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

export function extractSkola24FrameSource(skola24SSOResponseText: string) {
  const doc = html.parse(decode(skola24SSOResponseText))
  const frame = doc.querySelector('frameset frame');
  const src = frame?.getAttribute('src')
  return src;
}

export function extractSkola24LoginNovaSsoUrl(skola24LoginResponseText: string) {
  const doc = html.parse(decode(skola24LoginResponseText));
  const script = doc.querySelector('script')
  const scriptText = script?.rawText;
  const match = scriptText?.match(/(?<== ').*(?=';)/);
  return match && match[0];
}

export function extractAlingsasSamlAuthRequestForm(skola24LoginNovaSsoResponseText: string){
  const doc = html.parse(decode(skola24LoginNovaSsoResponseText));
  const form = doc.querySelector('form');
  const action = form?.getAttribute('action') || '';
  const input = doc.querySelector('input[name="SAMLRequest"]');
  const samlRequest = input?.getAttribute('value') || '';
  return {
    action,
    samlRequest
  }
}

export function extractAlingsasSamlAuthResponseForm(alingsasSamlAuthResponseText: string){
  const doc = html.parse(decode(alingsasSamlAuthResponseText));
  const form = doc.querySelector('form');
  const action = form?.getAttribute('action') || '';
  const samlResponse = doc.querySelector('input[name="SAMLResponse"]')?.getAttribute('value') || '';
  const relayState = doc.querySelector('input[name="RelayState"]')?.getAttribute('value') || '';
  return {
    action,
    samlResponse,
    relayState
  }
}

export const extractInputField = (sought: string, attrs: string[]) => {
  // there must be a better way to do this...
  const s = attrs.find(e => e.indexOf(sought) >= 0) || ""
  const v = s.substring(s.indexOf('value="') + 'value="'.length)
  return v.substring(0, v.length - 2)
}