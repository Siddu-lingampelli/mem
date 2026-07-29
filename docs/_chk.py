import re
t = open(r'A:\claude code\GItproject\mem-pro\docs\index.html', encoding='utf-8').read()
L = chr(60); SL = chr(47); G = chr(62)
broken_open = re.findall(L + r'([a-z][a-z0-9-]*[a-z0-9])(?:[ \t][^' + G + r']*?)' + L, t)
print('open tag without close >, immediately followed by <:', len(broken_open))
for b in broken_open[:10]:
    print('  tag:', b)
print()
print('total bytes:', len(t))
print('total lines:', t.count(chr(10)))
