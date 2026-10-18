"""Check for the box sanity filter. Run: python test_feet.py"""
import collections

from feet import Foot, filter_feet

A = 640 * 480
foot = lambda x: Foot(x, 300, x + 90, 380, 0.5, "shoe")
areas = collections.deque(maxlen=30)
for _ in range(6):
    filter_feet([foot(100), foot(300)], A, areas)

kept, rej = filter_feet([Foot(0, 0, 500, 400, 0.6, "foot"), foot(100)], A, areas)       # huge
assert len(kept) == 1 and len(rej) == 1
kept, rej = filter_feet([Foot(50, 50, 250, 250, 0.6, "foot"), foot(100)], A, areas)     # 5x typical size
assert len(kept) == 1 and len(rej) == 1
kept, rej = filter_feet([foot(10), foot(150), foot(300)], A, areas)                      # max 2
assert len(kept) == 2 and len(rej) == 1
print("ok")
