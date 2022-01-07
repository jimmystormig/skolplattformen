import * as html from 'node-html-parser'
import { decode } from 'he'

export class CommonService {
  static extractSamlAuthResponseForm(alingsasSamlAuthResponseText: string) {
    const doc = html.parse(decode(alingsasSamlAuthResponseText))
    const form = doc.querySelector('form')
    const action = form?.getAttribute('action') || ''
    const samlResponse =
      doc.querySelector('input[name="SAMLResponse"]')?.getAttribute('value') ||
      ''
    const relayState =
      doc.querySelector('input[name="RelayState"]')?.getAttribute('value') || ''
    return {
      action,
      samlResponse,
      relayState,
    }
  }
}
