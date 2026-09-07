import sys

with open('src/pages/cliente/Dashboard.tsx', 'r') as f:
    content = f.read()

target = 'className="py-2.5 px-2 sm:p-4 flex items-center justify-center text-center bg-[#ffffff]"'
replacement = 'className="pt-1.5 pb-2.5 px-2 sm:pt-2 sm:pb-3 sm:px-3 flex items-center justify-center text-center bg-[#ffffff]"'

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/cliente/Dashboard.tsx', 'w') as f:
        f.write(content)
    print("Success Dashboard")
else:
    print("Target not found Dashboard")
