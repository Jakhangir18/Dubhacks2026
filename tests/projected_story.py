"""Visual acceptance: run against uvicorn on 127.0.0.1:8790, with the host's Chromium.

Only session persistence is stubbed, to avoid writing server data outside web/ and tests/.
Coach, player configuration, rules, game clock and auto-walking run normally.
"""
import asyncio
import json
import time
from pathlib import Path

from playwright.async_api import async_playwright

SHOTS = Path('/tmp/rounds-look-shots')
CHROME = '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'


async def main():
    SHOTS.mkdir(exist_ok=True)
    errors, failed_assets, sessions = [], [], []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=CHROME, headless=True,
            args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: failed_assets.append(response.url)
                if '/art/' in response.url and response.status >= 400 else None)
        await page.add_init_script("""
          localStorage.setItem('zombiewalk.corners', JSON.stringify([[650,30],[1270,30],[1390,1050],[530,1050]]));
          window.storyStates = [];
          window.spoken = [];
          const speak = speechSynthesis.speak.bind(speechSynthesis);
          speechSynthesis.speak = utterance => { window.spoken.push(utterance.text); speak(utterance); };
          window.addEventListener('zombiewalk:pace', e => {
            window.storyState = {...e.detail};
            const key = e.detail.act + ':' + e.detail.round;
            if (window.storyStates.at(-1) !== key) window.storyStates.push(key);
          });
        """)

        async def persistence(route):
            if route.request.url.endswith('/start'):
                await route.fulfill(json={'id': '0123456789abcdef0123456789abcdef'})
            else:
                sessions.append(route.request.post_data_json['summary'])
                await route.fulfill(json={'note': 'Preview complete. Great walking!', 'gaitReview': None})

        await page.route('**/api/session', persistence)
        await page.route('**/api/session/start', persistence)
        await page.goto('http://127.0.0.1:8790/?demo=1&auto=1')
        await page.wait_for_function("window.zombieGame?.scene.isActive('title')")
        await page.keyboard.press('w')  # Watch a complete intro before restoring automatic steps.
        await page.wait_for_timeout(1800)
        await page.screenshot(path=str(SHOTS / 'intro-start.png'))
        await page.wait_for_timeout(11000)
        await page.screenshot(path=str(SHOTS / 'intro-end.png'))
        await page.wait_for_function("document.getElementById('story-screen').classList.contains('intro-walking')", timeout=12000)
        assert await page.evaluate("window.zombieGame.scene.isActive('title')"), 'Intro must loop until steps arrive'
        warp = await page.locator('#stage').evaluate('(el) => el.style.transform')
        await page.keyboard.press('w')
        seen = set()
        deadline = time.monotonic() + 240
        while time.monotonic() < deadline:
            state = await page.evaluate("""() => {
              const play = window.zombieGame.scene.getScene('play');
              return {act: window.storyState?.act, round: play.g?.round,
                things: play.g?.things.filter(t => !t.result).length,
                textures: [...(play.sprites?.values() || [])].filter(s => s.visible).map(s => s.list[2].texture.key)};
            }""")
            act, round_number = state['act'], state.get('round')
            key = f'{act}-{round_number}'
            if key not in seen and (act == 'rest' or act == 'garden' and state['textures']):
                seen.add(key)
                name = f'rest-{round_number - 1}' if act == 'rest' else f'round-{round_number}'
                await page.wait_for_timeout(400)
                await page.screenshot(path=str(SHOTS / f'{name}.png'))
                print(name, json.dumps(state), flush=True)
                if act == 'garden':
                    expected = {1: {'flower', 'flower-bell', 'flower-rose'}, 2: {'spitter'}, 3: {'spikeweed'}}[round_number]
                    assert set(state['textures']) <= expected, state
            if act == 'home':
                await page.keyboard.press('w')  # Keep the finished summary available for visual review.
                result = await page.evaluate("window.zombieGame.scene.getScene('home').homeData.summary")
                judged = sum(pair[1] for lanes in result['byLane'].values() for pair in lanes.values())
                assert judged == 18, judged
                await page.wait_for_timeout(3400)
                await page.screenshot(path=str(SHOTS / 'finish-animation.png'))
                await page.wait_for_function("!document.body.classList.contains('story-active')", timeout=20000)
                await page.screenshot(path=str(SHOTS / 'finish.png'))
                assert len(seen) == 5, seen
                assert sessions and sessions[-1]['byLane'] == result['byLane']
                assert await page.locator('#stage').evaluate('(el) => el.style.transform') == warp
                spoken = await page.evaluate('window.spoken')
                assert any('Pea spitters' in line for line in spoken), spoken
                assert any('spike patch' in line for line in spoken), spoken
                assert any('Round 1 done' in line for line in spoken), spoken
                print(f'PASS: {judged} targets judged; all three rounds and both rests captured; session payload matches.', flush=True)
                break
            await page.wait_for_timeout(200)
        else:
            raise AssertionError('Demo did not finish within 240 seconds')

        # The overlay must hand input and the calibrated field back to the existing game.
        await page.goto('http://127.0.0.1:8790/?scene=play&act=garden&line=0.68')
        await page.wait_for_function("window.zombieGame?.scene.getScene('play')?.g?.act === 'garden'")
        assert await page.evaluate("window.zombieGame.scene.getScene('play').layout().zoneY / 1280") == .68
        await page.keyboard.press('m')
        assert await page.evaluate("localStorage.getItem('zombiewalk.voiceOn')") == 'false'
        await page.keyboard.press('m')
        assert await page.evaluate("localStorage.getItem('zombiewalk.voiceOn')") == 'true'
        await page.keyboard.press('q')
        await page.keyboard.press('e')
        await page.wait_for_function("window.zombieGame.scene.getScene('play').g.stats.steps === 2")
        await page.keyboard.press('Space')
        frozen = await page.evaluate("window.zombieGame.scene.getScene('play').g.t")
        await page.wait_for_timeout(300)
        assert await page.evaluate("window.zombieGame.scene.getScene('play').g.t") == frozen
        await page.keyboard.press('Space')
        await page.set_viewport_size({'width': 1600, 'height': 900})
        await page.wait_for_function("window.zombieGame.scene.getScene('play').paused")
        assert await page.evaluate("window.zombieGame.scene.getScene('play').pauseBanner.text.includes('PROJECTOR?')")
        await page.set_viewport_size({'width': 1920, 'height': 1080})
        await page.goto('http://127.0.0.1:8790/')
        await page.wait_for_function("window.zombieGame?.scene.isActive('title')")
        await page.keyboard.press('Enter')
        await page.wait_for_function("window.zombieGame.scene.isActive('play')")
        print('PASS: unchanged warp, intro looping/Enter, scene/act/line shortcuts, M, Q/E, Space and PROJECTOR? pause.', flush=True)
        assert not errors, errors
        assert not failed_assets, failed_assets
        print(f'PASS: page errors={errors}; failed assets={failed_assets}', flush=True)
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
