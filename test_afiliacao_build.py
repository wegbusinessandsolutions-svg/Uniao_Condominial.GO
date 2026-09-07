import subprocess
result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
if result.returncode == 0:
    print("Build successful")
else:
    print("Build failed:")
    print(result.stdout)
    print(result.stderr)
