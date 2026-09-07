import sys

with open('src/pages/cliente/MeusContatos.tsx', 'r') as f:
    content = f.read()

target = """              <div className="flex justify-between items-start lg:items-center min-w-0 lg:w-1/3 shrink-0">"""
replacement = """              <div className="flex justify-between items-start lg:items-center min-w-0 lg:w-4/12 shrink-0">"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/cliente/MeusContatos.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
