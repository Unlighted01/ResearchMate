@echo off
certutil -decode public\icons\temp.b64 public\icons\icon16.png
certutil -decode public\icons\temp.b64 public\icons\icon48.png
certutil -decode public\icons\temp.b64 public\icons\icon128.png
dir public\icons
