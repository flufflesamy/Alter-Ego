import subprocess
import sys
import write_config

write_config.write()

with open('../alter-ego.log', 'a') as logfile:
    proc = subprocess.Popen(['node', '../bot.js'], universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in proc.stdout:
        sys.stdout.write(line)
        logfile.write(line)
    proc.wait()