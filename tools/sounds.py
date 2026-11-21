from pathlib import Path
import math, random, wave, struct
out = Path(__file__).resolve().parents[1] / 'assets'
out.mkdir(exist_ok=True)
for name, pitch, duration in [('lift', 450, .17), ('land', 240, .24), ('fall', 90, .32)]:
    rand = random.Random(710)
    with wave.open(str(out / (name + '.wav')), 'wb') as audio:
        audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        for i in range(int(duration * 16000)):
            t = i / 16000
            value = (.6 * math.sin(2*math.pi*pitch*t*(1+t)) + .4 * rand.uniform(-1, 1))
            audio.writeframesraw(struct.pack('<h', int(value * 18000 * (1-t/duration)**2)))

