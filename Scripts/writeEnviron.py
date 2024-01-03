import json
from os import environ

# Write Credentials

with open('../credentials.json', 'r') as credentials:
    credentials = json.load(credentials)

if environ.get('DISCORD_TOKEN') is not None:
    credentials['discord']['token'] = environ.get('DISCORD_TOKEN')

for key in credentials['google']:
    if environ.get('G_' + key.upper()) is not None:
        credentials['google'][key] = environ.get('G_' + key.upper())

formatted_credentials = json.dumps(credentials, indent=4)

# print(formatted_credentials)

with open('../credentials.json', 'w') as credentials:
    credentials.write(formatted_credentials)

# Write Settings
    
with open('../settings.json', 'r', encoding='utf-8-sig') as settings:
    settings = json.load(settings)

print(settings['commandPrefix'])

for key in settings:
    if environ.get('S_' + key.upper()) is not None:
        settings[key] = environ.get('S_' + key.upper())

formatted_settings = json.dumps(settings, indent=4)

with open('../settings.json', 'w') as settings:
    settings.write(formatted_settings)