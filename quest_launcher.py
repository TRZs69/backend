#!/usr/bin/env python3
import os
import subprocess
import sys
import time
import json
import threading
import select
import termios
import tty
from collections import deque

# ANSI Color Codes
GREEN = "\033[0;32m"
BRIGHT_GREEN = "\033[1;32m"
YELLOW = "\033[1;33m"
CYAN = "\033[1;36m"
WHITE = "\033[1;37m"
RED = "\033[1;31m"
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

PROGRESS_FILE = ".release_audit.json"
WEB_URL = "http://localhost:8081"
APP_LOG = "app_launch.log"
STDIN_PIPE = "flutter_stdin"

SECTORS = [
    {"id": 1, "group": "AUTH", "name": "User Onboarding Sequence", "pattern": "welcome_primary.png"},
    {"id": 2, "group": "AUTH", "name": "Token Persistence Layer", "pattern": "background-pattern"},
    {"id": 3, "group": "AUTH", "name": "Security Timeout Hook", "pattern": "logo-png.png"},
    {"id": 4, "group": "CORE", "name": "PDF Rendering Engine", "pattern": "material-pixel.png"},
    {"id": 5, "group": "CORE", "name": "Adaptive ELO Algorithm", "pattern": "assessment-pixel.png"},
    {"id": 6, "group": "CORE", "name": "Input Submission Pipeline", "pattern": "assignment-pixel.png"},
    {"id": 7, "group": "AI",   "name": "Chatbot Context Injection", "pattern": "levely_thinking.svg"},
    {"id": 8, "group": "AI",   "name": "Streaming Response Buffer", "pattern": "levely_new_chat.svg"},
    {"id": 9, "group": "SOCIAL", "name": "Marketplace Transaction Logic", "pattern": "banner-gold.png"},
    {"id": 10, "group": "SOCIAL", "name": "Social Graph Connectivity", "pattern": "banner-silver.png"},
]

class AuditConsole:
    def __init__(self):
        self.prog = self.load_progress()
        self.signals = deque(maxlen=5)
        self.evidence = set()
        self.running = True
        self.status = "AUDIT CONSOLE ONLINE"
        self.input_buffer = ""
        self.last_draw_hash = ""
        self.link_status = f"{RED}OFFLINE{RESET}"

    def load_progress(self):
        if os.path.exists(PROGRESS_FILE):
            try:
                with open(PROGRESS_FILE, 'r') as f:
                    return json.load(f)
            except: pass
        return {"verified": []}

    def save_progress(self):
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(self.prog, f)

    def log_monitor(self):
        """Advanced log monitor with auto-reconnect logic."""
        last_ino = -1
        f = None
        
        while self.running:
            if not os.path.exists(APP_LOG):
                self.link_status = f"{RED}WAITING FOR LOG...{RESET}"
                time.sleep(1)
                continue

            try:
                curr_ino = os.stat(APP_LOG).st_ino
                # If file changed (rebooted) or not open yet
                if curr_ino != last_ino:
                    if f: f.close()
                    f = open(APP_LOG, 'r')
                    # If it's a new file, read from start. If just opened, seek to end.
                    if last_ino != -1: f.seek(0)
                    else: f.seek(0, 2)
                    last_ino = curr_ino
                    self.link_status = f"{BRIGHT_GREEN}LINK ESTABLISHED{RESET}"

                line = f.readline()
                if line:
                    self.process_signal(line.strip())
                else:
                    # Check if file was truncated (reboot without delete)
                    if os.path.getsize(APP_LOG) < f.tell():
                        f.seek(0)
                    time.sleep(0.2)
            except Exception:
                self.link_status = f"{RED}LINK ERROR{RESET}"
                time.sleep(1)

    def process_signal(self, line, update_status=True):
        if "GET" in line:
            matched = False
            for s in SECTORS:
                if s['pattern'] in line:
                    matched = True
                    if s['id'] not in self.evidence:
                        self.evidence.add(s['id'])
                        if update_status:
                            self.status = f"SIGNAL INTERCEPTED: {s['group']}"
            if matched:
                parts = line.split('"')
                if len(parts) > 1:
                    sig = parts[1].replace("GET ", "").replace(" HTTP/1.1", "")
                    self.signals.append(sig[:55])

    def hot_restart(self):
        if os.path.exists(STDIN_PIPE):
            self.status = "INITIATING HOT RESTART..."
            try:
                fd = os.open(STDIN_PIPE, os.O_WRONLY | os.O_NONBLOCK)
                os.write(fd, b"R\n")
                os.close(fd)
            except: self.status = "ENGINE BUSY"
        else:
            self.status = "ENGINE OFFLINE"

    def draw(self):
        v_ids = self.prog['verified']
        current_state = f"{self.status}|{list(self.signals)}|{list(self.evidence)}|{v_ids}|{self.input_buffer}|{self.link_status}"
        if current_state == self.last_draw_hash:
            return
        self.last_draw_hash = current_state

        sys.stdout.write("\033[H\033[2J")
        percent = (len(v_ids) / len(SECTORS)) * 100
        output = []
        output.append(f"{WHITE}{BOLD}┌────────────────────────────────────────────────────────────┐{RESET}")
        output.append(f"{WHITE}│ {BOLD}RELEASE READINESS AUDIT CONSOLE{RESET} {WHITE}v3.1 (AUTO-SYNC)          │{RESET}")
        output.append(f"{WHITE}├────────────────────────────────────────────────────────────┤{RESET}")
        
        filled = int(40 * len(v_ids) // len(SECTORS))
        bar = f"{BRIGHT_GREEN}█" * filled + f"{DIM}▒" * (40 - filled)
        output.append(f"{WHITE}│ INTEGRITY: [{bar}{RESET}{WHITE}] {percent:>3.0f}% verified          │{RESET}")
        output.append(f"{WHITE}│ NEURAL LINK: {self.link_status:<45} │{RESET}")
        output.append(f"{WHITE}│ STATUS: {self.status:<50} │{RESET}")
        output.append(f"{WHITE}└────────────────────────────────────────────────────────────┘{RESET}")
        
        output.append(f"\n{CYAN}{BOLD}📡 NEURAL SIGNAL INTERCEPTOR (LIVE):{RESET}")
        sigs = list(self.signals)
        for i in range(5):
            sig_text = sigs[i] if i < len(sigs) else ""
            output.append(f" {DIM}» {sig_text:<55}{RESET}")

        output.append(f"\n{BOLD}VERIFICATION SECTORS:{RESET}")
        for s in SECTORS:
            v = s['id'] in v_ids
            e = s['id'] in self.evidence
            mark = f"{BRIGHT_GREEN}[ SECURED ]{RESET}" if v else (f"{YELLOW}[ EVIDENCE ]{RESET}" if e else f"{RED}[ PENDING ]{RESET}")
            style = DIM if v else (BOLD if e else "")
            output.append(f" {mark} {style}{s['id']:>2}. {s['group']:<8} : {s['name']:<28}{RESET}")

        output.append(f"\n{BOLD}CONTROLS: [L] Warp  [H] Hot Restart  [#] Verify  [Q] Exit{RESET}")
        output.append(f"\n{WHITE}{BOLD}AUDITOR COMMAND > {self.input_buffer}{RESET}")
        
        sys.stdout.write("\n".join(output))
        sys.stdout.flush()

    def handle_command(self, cmd):
        cmd = cmd.lower().strip()
        if not cmd: return
        if cmd == 'l':
            subprocess.Popen(["xdg-open", WEB_URL], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.status = "PORTAL ACCESS ACTIVE"
        elif cmd == 'h':
            self.hot_restart()
        elif cmd == 'q':
            self.running = False
        elif cmd.isdigit():
            sid = int(cmd)
            sector = next((s for s in SECTORS if s['id'] == sid), None)
            if sector and sid not in self.prog['verified']:
                self.prog['verified'].append(sid)
                self.save_progress()
                self.status = f"SECTOR {sid} SIGNED OFF"
            else: self.status = "ID INVALID OR SECURED"

    def run(self):
        sys.stdout.write("\033[?1049h\033[?25l")
        sys.stdout.flush()
        threading.Thread(target=self.log_monitor, daemon=True).start()
        
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            new_settings = termios.tcgetattr(fd)
            new_settings[3] = new_settings[3] & ~termios.ECHO & ~termios.ICANON
            termios.tcsetattr(fd, termios.TCSADRAIN, new_settings)
            
            while self.running:
                self.draw()
                rlist, _, _ = select.select([sys.stdin], [], [], 0.1)
                if rlist:
                    char = sys.stdin.read(1)
                    if char in ('\n', '\r'):
                        self.handle_command(self.input_buffer)
                        self.input_buffer = ""
                        self.last_draw_hash = ""
                    elif char in ('\x7f', '\x08'): # Backspace
                        self.input_buffer = self.input_buffer[:-1]
                        self.last_draw_hash = ""
                    elif ord(char) >= 32: # Printable
                        self.input_buffer += char
                        self.last_draw_hash = ""
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            sys.stdout.write("\033[?25h\033[?1049l")
            sys.stdout.flush()
            print("Audit Suspended.")

if __name__ == "__main__":
    console = AuditConsole()
    console.run()
