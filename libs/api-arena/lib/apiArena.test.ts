import init from './'
import { ApiArena } from './apiArena'
import { Fetch, Headers, Response } from '@skolplattformen/api'
import CookieManager from '@react-native-cookies/cookies'

jest.mock('@react-native-cookies/cookies')

interface ResponseExtended extends Response {
  url: string
}

describe('api', () => {
  let fetch: jest.Mocked<Fetch>
  let response: jest.Mocked<ResponseExtended>
  let headers: jest.Mocked<Headers>
  let api: ApiArena

  beforeEach(() => {
    headers = { get: jest.fn() }
    response = {
      json: jest.fn(),
      text: jest.fn(),
      ok: true,
      status: 200,
      statusText: 'ok',
      headers,
      url: '',
    }
    fetch = jest.fn().mockResolvedValue(response)
    response.text.mockResolvedValue('<html></html>')
    response.json.mockResolvedValue({ infotext: '', location: '' })
    CookieManager.clearAll()
    api = init(fetch, CookieManager) as ApiArena
  })

  describe('#login', () => {
    it('sets isLoggedIn and personal number after succesful login', async () => {
      const personalNumber = 'my personal number'

      await api.login(personalNumber)

      expect(api.isLoggedIn).toBe(true)
      expect(api.getPersonalNumber()).toBe(personalNumber)
    })
  })
})
