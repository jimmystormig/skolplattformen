import CookieManager from '@react-native-cookies/cookies'
import initHjarntorget, {
  features as featuresHjarntorget,
} from '@skolplattformen/api-hjarntorget'
import initArena, {
  features as featuresArena,
} from '@skolplattformen/api-arena'
import initSkolplattformen, {
  features as featuresSkolPlattformen,
} from '@skolplattformen/api-skolplattformen'

export const schoolPlatforms = [
  {
    id: 'stockholm-skolplattformen',
    displayName: 'Stockholms stad (Skolplattformen)',
    api: initSkolplattformen(fetch as any, CookieManager),
    features: featuresSkolPlattformen,
  },
  {
    id: 'goteborg-hjarntorget',
    displayName: 'Göteborgs Stad (Hjärntorget)',
    api: initHjarntorget(fetch as any, CookieManager),
    features: featuresHjarntorget,
  },
  {
    id: 'alingsas-arena',
    displayName: 'Alingsås stad (Arena)',
    api: initArena(fetch as any, CookieManager),
    features: featuresArena,
  },
]
