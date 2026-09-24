import sys, time, multiprocessing as mp
def burn(t):
    end = time.time() + t
    while time.time() < end: pass
if __name__ == "__main__":
    n, t = int(sys.argv[1]), float(sys.argv[2])
    ps = [mp.Process(target=burn, args=(t,)) for _ in range(n)]
    [p.start() for p in ps]; [p.join() for p in ps]
