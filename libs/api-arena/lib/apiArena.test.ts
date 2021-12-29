import init from './'
import { ApiArena } from './apiArena'
import { Fetch, Headers, Response } from '@skolplattformen/api'
import CookieManager from '@react-native-cookies/cookies'

jest.mock('@react-native-cookies/cookies')

describe('api', () => {
    let fetch: jest.Mocked<Fetch>
    let response: jest.Mocked<Response>
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
      }
      fetch = jest.fn().mockResolvedValue(response)
      response.text.mockResolvedValue('<html></html>')
      CookieManager.clearAll()
      api = init(fetch, CookieManager) as ApiArena
    })
    describe('#login', () => {
        it('exposes token', async () => {
          const data = {
            token: '9462cf77-bde9-4029-bb41-e599f3094613',
            order: '5fe57e4c-9ad2-4b52-b794-48adef2f6663',
          }
          response.json.mockResolvedValue(data)
    
          const personalNumber = 'my personal number'
          const status = await api.login(personalNumber)
    
          expect(status.token).toEqual(data.token)
          status.cancel()
        })
    });
})
