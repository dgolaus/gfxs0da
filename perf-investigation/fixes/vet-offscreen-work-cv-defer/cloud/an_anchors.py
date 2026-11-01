import json,sys,collections,statistics as st
for f in sys.argv[1:]:
  d=json.load(open(f))
  dur=collections.defaultdict(list); fin=collections.defaultdict(set); gr=collections.defaultdict(list); s100=collections.defaultdict(list)
  for r in d:
    j=r['jumps']; w=0
    if len(j)>2: w=j[-1][0]-j[1][0]
    dur[r['v']].append(w)
    fin[(r['sz'],r['h'])].add((r['sy'],r['top'],r['docH'],r['limit']))
    if r['h'] in ('about','process'):
      tj=j[1][0] if len(j)>1 else 0
      seq=[x[1] for x in r['grad'] if x[0]>=tj and x[1] is not None][:6]
      gr[(r['sz'],r['h'],r['r'])].append((r['v'],seq[:4]))
  print(f)
  for v,x in dur.items(): print('  wrong-offset frame ms', v, 'n',len(x),'shown in',sum(1 for y in x if y),'mean',round(st.mean(x)),'median',st.median(x),'max',max(x))
  bad=[(k,s) for k,s in fin.items() if len(set((a,b,c) for a,b,c,_ in s))>1]
  print('  final mismatches', bad)
  print('  limits', set(l for s in fin.values() for *_,l in s))
  for k,v in gr.items():
    base=[s for n,s in v if n=='baseline']
    print('  grad',k,' | '.join(f'{n}:{s}' for n,s in v))
