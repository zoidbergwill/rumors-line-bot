<script>
  import { onMount } from 'svelte';
  import { page } from './lib';
  import Articles from './pages/Articles.svelte';
  import Source from './pages/Source.svelte';
  import Reason from './pages/Reason.svelte';
  import UserSetting from './pages/UserSetting.svelte';
  import PositiveFeedback from './pages/PositiveFeedback.svelte';
  import NegativeFeedback from './pages/NegativeFeedback.svelte';

  const routes = {
    articles: Articles,
    source: Source,
    reason: Reason,
    'feedback/yes': PositiveFeedback,
    'feedback/no': NegativeFeedback,
    setting: UserSetting,
  };

  // Send pageview with correct path on each page change.
  // delay a bit for page components to change page title
  page.subscribe(p => {
    setTimeout(() => {
      gtag('event', 'page_view', { page_path: p });
    }, 10)
  });

  onMount(() => {
    if(window.performance) {
      gtag('event', 'timing_complete', {
        name: 'App mounted',
        value: performance.now(),
        event_category: 'LIFF',
        event_label: 'App',
      });
      if(performance.navigation) {
        gtag('event', 'page_redirect', {
          event_category: 'LIFF',
          event_label: 'App',
          value: performance.navigation.redirectCount,
        });
      }
    }
  })
</script>

<svelte:component this={routes[$page]} />
