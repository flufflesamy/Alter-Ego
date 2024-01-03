import subprocess
import sys
import write_config

write_config.write()

with open('/home/node/app/alter-ego.log', 'a') as logfile:
    proc = subprocess.Popen(['node', '/home/node/app/bot.js'], universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in proc.stdout:
        sys.stdout.write(line)
        logfile.write(line)
    proc.wait()