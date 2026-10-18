"""Run against the local demo server with the project's Python Playwright environment."""
import time

from playwright.sync_api import sync_playwright


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path='/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
            headless=True, args=['--no-sandbox'],
        )
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        base = 'http://127.0.0.1:8790'

        def state():
            result = page.request.get(base + '/api/game/state').json()
            return result['state'] if result['connected'] else None

        def wait_for(predicate, timeout=20):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                current = state()
                if current and predicate(current):
                    return current
                page.wait_for_timeout(100)
            raise AssertionError(f'State did not match: {state()}')

        def command(cmd, predicate):
            response = page.request.post(base + '/api/game/control', data={'cmd': cmd})
            assert response.ok, response.text()
            result = wait_for(predicate)
            print(cmd, result['scene'], result['act'], result['paused'], result['voice'], result['speed'])
            return result

        page.goto(base + '/?demo=1')
        page.locator('#save-zone').click()
        initial = wait_for(lambda s: s['scene'] == 'title')
        command('start', lambda s: s['scene'] == 'intro')
        wait_for(lambda s: s['scene'] == 'ready')
        command('start', lambda s: s['scene'] == 'play' and s['act'] == 'walk')
        command('pause', lambda s: s['paused'])
        command('resume', lambda s: not s['paused'])
        command('voice', lambda s: s['voice'] != initial['voice'])
        current = state()
        assert current is not None
        old = current['speed']
        command('faster', lambda s: abs(s['speed'] - old - .1) < .001)
        steps = page.evaluate("window.zombieGame.scene.getScene('play').g.stats.steps")
        current = state()
        assert current is not None
        before = current['t']
        command('autowalk', lambda s: s['t'] > before)
        page.wait_for_function("n => window.zombieGame.scene.getScene('play').g.stats.steps > n", arg=steps)
        saves = []
        page.on('request', lambda r: saves.append(r.post_data_json) if r.url.endswith('/api/session') and r.method == 'POST' else None)
        command('end', lambda s: s['scene'] == 'home')
        assert len(saves) == 1, saves
        command('restart', lambda s: s['scene'] == 'title' and s['sessionId'] is None)
        # Replayed ids must not toggle voice twice, even in a later scene.
        page.evaluate("""() => {
          const ev = {kind: 'control', cmd: 'voice', id: 'browser-duplicate'};
          window.dispatchEvent(new CustomEvent('zombiewalk:control', {detail: ev}));
          window.dispatchEvent(new CustomEvent('zombiewalk:control', {detail: ev}));
        }""")
        wait_for(lambda s: s['voice'] == initial['voice'])
        command('start', lambda s: s['scene'] == 'intro')
        wait_for(lambda s: s['scene'] == 'ready')
        command('start', lambda s: s['scene'] == 'play')
        command('slower', lambda s: abs(s['speed'] - old) < .001)
        # Isolate the rest control without waiting for the full garden round.
        page.evaluate("""() => {
          const play = window.zombieGame.scene.getScene('play');
          play.g.act = 'rest'; play.g.round = 2; play.countdownAt = null;
        }""")
        wait_for(lambda s: s['act'] == 'rest')
        command('next', lambda s: s['act'] == 'rest')
        page.wait_for_function("window.zombieGame.scene.getScene('play').countdownAt !== null")
        wait_for(lambda s: s['act'] == 'garden', timeout=10)
        command('pause', lambda s: s['paused'])
        command('restart', lambda s: s['scene'] == 'title')
        assert len(saves) == 2, saves
        assert not errors, errors
        print('PASS: dashboard sequence, autowalk steps, one session save, id deduplication; no page errors')
        browser.close()


if __name__ == '__main__':
    run()
