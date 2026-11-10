import json, re, glob, os, sys, markdown
SES='/root/.claude/projects/-home-user/2fd69305-d550-5451-9de6-2eb642bf1fcf'
OUT='/home/user/psy_study_app/data/learn'
os.makedirs(OUT, exist_ok=True)
pages={}
def add(o):
    if o.get('metadata',{}).get('type')!='page': return
    pid=re.search(r'/p/([0-9a-f]{32})',o['url']).group(1)
    old=pages.get(pid)
    if old and old.get('page_last_edited_at','')>o.get('page_last_edited_at',''): return
    pages[pid]=o
SESS=[x for x in [SES,'/root/.claude/projects/-home-user-psy-study-app/2fd69305-d550-5451-9de6-2eb642bf1fcf'] if os.path.exists(x+'.jsonl')]
for SES in SESS:
 for line in open(SES+'.jsonl'):
     o=json.loads(line)
     m=o.get('message',{})
     if not isinstance(m.get('content'),list): continue
     for c in m['content']:
         if c.get('type')!='tool_result' or not isinstance(c.get('content'),list): continue
         for t in c['content']:
             if t.get('type')=='text' and t['text'].startswith('{"metadata"'):
                 try: add(json.loads(t['text']))
                 except Exception: pass
for f in [g for S in SESS for g in glob.glob(S+'/tool-results/mcp-Notion-notion-fetch-*.txt')]:
    raw=open(f).read()
    try: o=json.loads(raw)
    except Exception: o=json.loads(json.loads(raw)[0]['text'])
    if isinstance(o,list): o=json.loads(o[0]['text'])
    add(o)

LECT=[  # id, subject, notion id, kind, date
 ('gend-1','gend','4031407deeae81c88b0af75708918815','lecture','2026-10-22'),
 ('gend-2','gend','4031407deeae815ab4b0e766596bcd37','lecture','2026-10-22'),
 ('gend-3','gend','4031407deeae8121b70fd1abdf35fa15','lecture','2026-10-24'),
 ('gend-4','gend','4041407deeae8119a211dacfeb3d03f2','lecture','2026-10-24'),
 ('gend-5','gend','4041407deeae816ba51cea1661614946','lecture','2026-10-25'),
 ('gend-p1','gend','4041407deeae811893caffbc54e1d2c8','practice','2026-10-25'),
 ('corr-1','corr','4001407deeae81a29d95f6d31b1a85dd','lecture','2026-10-20'),
 ('corr-2','corr','4001407deeae8181a0f1d191a685184a','lecture','2026-10-20'),
 ('mil-1','mil','3f91407deeae81cbb76cf3da6957dce4','lecture','2026-10-13'),
 ('mil-2','mil','3fb1407deeae81adba0ce35d7fa5113c','lecture','2026-10-15'),
 ('mil-3','mil','4011407deeae812b8887e999352fa567','lecture','2026-10-22'),
 ('mil-4','mil','4061407deeae81a3bc55ceadc45c65c0','lecture','2026-10-27'),
 ('mil-5','mil','40e1407deeae81aab5acda0e9dd29a68','lecture','2026-10-29'),
 ('mil-6','mil','40e1407deeae81a48c63db2111a24152','lecture','2026-11-03'),
 ('mil-7','mil','4141407deeae819db3b2f722d1a0e299','lecture','2026-11-10'),
 ('mil-ref','mil','40e1407deeae811b8d8be7a8f3b52f35','ref',None),
 ('meth-qa','meth','4001407deeae8108a6a4f3129b97735c','qa',None),
]
COLORS={'gray':'gray','red':'red','blue':'blue','green':'green','purple':'purple','yellow':'yellow','orange':'yellow','pink':'red','brown':'gray'}
def clean(t):
    t=t[t.index('<content>')+9:t.rindex('</content>')]
    t=re.sub(r'<page url="[^"]*">.*?</page>','',t,flags=re.S)
    t=re.sub(r',?\s*/mnt/project-files/[^\s)<]*?\.(pdf|txt|pptx|docx)','',t)
    t=re.sub(r'Розшифровка: <code>[^<]*</code>\.\s*','',t)
    t=re.sub(r'(Розшифровка збережена в|Розшифровка:|Тексти збережені в|Текст збережений у) [^\n<]*?\.(txt)?\.?(?=\s|<)','',t)
    t=re.sub(r'<mention url="[^"]*">(.*?)</mention>',r'«\1»',t,flags=re.S)
    NAMES={'4061407deeae81a3bc55ceadc45c65c0':'Лекція 4','40e1407deeae81a48c63db2111a24152':'Лекція 6','40e1407deeae81aab5acda0e9dd29a68':'Лекція 5'}
    t=re.sub(r'<mention url="[^"]*?([0-9a-f]{32})[^"]*"\s*/>',lambda m:'«'+NAMES[m.group(1)]+'»' if m.group(1) in NAMES else '',t)
    t=re.sub(r'<mention[^>]*/>','',t)
    t=re.sub(r'\[(<b>)?([^\]]*?)(</b>)?\]\(http://[\d.]+mp\)(<b>)?(\w)?(</b>)?',lambda m:'<b>'+m.group(2)+(m.group(5) or '')+'</b>',t)
    t=re.sub(r'\[[^\]]*\]\(mailto:[^)]*\)','(пошта є в чаті курсу)',t)
    t=re.sub(r'[\w.+-]+@[\w-]+\.[\w.]+','(пошта є в чаті курсу)',t)
    t=t.replace('\\~','~').replace('\\<','&lt;').replace('\\>','&gt;')
    t=re.sub(r'^(\s*)- \[ \] ',r'\1- ☐ ',t,flags=re.M)
    t=re.sub(r'^(\s*)- \[x\] ',r'\1- ☑ ',t,flags=re.M)
    def callout(m):
        icon,color,body=m.group(1),m.group(2),m.group(3)
        c=COLORS.get(color.replace('_bg',''),'gray')
        return f'\n<div class="callout {c}" markdown="1">\n<span class="ci">{icon}</span>\n\n{body.strip()}\n\n</div>\n'
    t=re.sub(r'<callout icon="([^"]*)" color="([^"]*)">(.*?)</callout>',callout,t,flags=re.S)
    t=re.sub(r'<quote>\s*<p />\s*(.*?)</quote>',lambda m:'\n> '+m.group(1).strip().replace('\n','\n> ')+'\n',t,flags=re.S)
    t=re.sub(r'<p color="[^"]*">','<p class="muted">',t)
    return t
def render(md):
    return markdown.markdown(md, extensions=['tables','md_in_html','sane_lists'])

index=[]
for lid,subj,pid,kind,date in LECT:
    o=pages.get(pid)
    if not o: print('MISSING',lid); continue
    title=re.sub(r'^\W+\s*','',o['title']).replace(' (конспект)','')
    md=clean(o['text'])
    if kind=='qa':
        # split into cards
        cards=[]; lecture=None
        for blk in re.split(r'\n(?=## |### )',md):
            if blk.startswith('## '): lecture=blk.splitlines()[0][3:].strip(); continue
            if blk.startswith('### '):
                lines=blk.split('\n',1); q=lines[0][4:].strip(); a=lines[1] if len(lines)>1 else ''
                q=re.sub(r'^(\d+)\.\s*',r'\1. ',q)
                cards.append(dict(q=q,lecture=lecture,a=render(a)))
        json.dump(cards,open(f'{OUT}/{lid}.json','w',encoding='utf-8'),ensure_ascii=False)
        index.append(dict(id=lid,subject=subj,kind=kind,title='80 питань до іспиту з відповідями',count=len(cards),file=f'{lid}.json'))
        print(lid,len(cards),'cards')
        continue
    html=render(md)
    # review points from blue callout
    m=re.search(r'<div class="callout blue">(.*?)</div>',html,re.S)
    points=re.findall(r'<li>(.*?)</li>',m.group(1),re.S) if m else []
    open(f'{OUT}/{lid}.html','w',encoding='utf-8').write(html)
    index.append(dict(id=lid,subject=subj,kind=kind,title=title,date=date,file=f'{lid}.html',points=len(points),minutes=max(5,round(len(re.sub('<[^>]+>','',html).split())/180))))
    print(lid,title[:50],len(html))
json.dump(index,open(f'{OUT}/index.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
