import tkinter as tk
from tkinter import filedialog, messagebox
import numpy as np
import cv2
import pyautogui
import threading
import time
import keyboard
import math

pyautogui.FAILSAFE = True
# Was 0.0 (no breathing room between calls -> floods the OS input queue and
# causes system-wide lag). A small pause after every mouseDown/mouseUp/
# moveTo/dragTo call throttles the event rate without slowing the drawing
# down noticeably to the eye.
pyautogui.PAUSE = 0.01

STOP_HOTKEY = "esc"


def interpolate_line(x1, y1, x2, y2, step=2.0):
    dist = math.hypot(x2 - x1, y2 - y1)
    steps = max(1, int(dist / step))
    pts = []
    for i in range(steps + 1):
        t = i / steps
        pts.append((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
    return pts


class RegionSelector:
    def __init__(self, root, callback):
        self.callback = callback
        self.start_x = self.start_y = None
        self.rect = None
        ws = root.winfo_screenwidth()
        hs = root.winfo_screenheight()
        self.overlay = tk.Toplevel(root)
        self.overlay.overrideredirect(True)
        self.overlay.attributes("-alpha", 0.3, "-topmost", True)
        self.overlay.geometry(f"{ws}x{hs}+0+0")
        self.overlay.config(bg="gray")
        self.cv = tk.Canvas(self.overlay, highlightthickness=0, cursor="crosshair")
        self.cv.pack(fill=tk.BOTH, expand=True)
        self.cv.bind("<ButtonPress-1>", self.on_press)
        self.cv.bind("<B1-Motion>", self.on_drag)
        self.cv.bind("<ButtonRelease-1>", self.on_release)
        self.overlay.bind("<Escape>", lambda e: self.overlay.destroy())

    def on_press(self, e):
        self.start_x, self.start_y = e.x_root, e.y_root
        self.rect = self.cv.create_rectangle(
            e.x, e.y, e.x, e.y, outline="red", width=3, fill="white",
            stipple="gray25")

    def on_drag(self, e):
        if self.rect:
            self.cv.coords(self.rect, self.start_x, self.start_y, e.x_root, e.y_root)

    def on_release(self, e):
        x1, y1 = self.start_x, self.start_y
        x2, y2 = e.x_root, e.y_root
        x, y = min(x1, x2), min(y1, y2)
        w, h = abs(x2 - x1), abs(y2 - y1)
        self.overlay.destroy()
        if w > 20 and h > 20:
            self.callback(x, y, w, h)


class AutoDraw:
    def __init__(self, root):
        self.root = root
        self.root.title("Auto Draw")
        self.root.attributes("-topmost", True)
        ws = self.root.winfo_screenwidth()
        self.root.geometry(f"480x55+{(ws-480)//2}+15")
        self.root.resizable(False, False)
        self.root.configure(bg="#2c2c2c")

        self.img_original = None
        self.draw_paths = []
        self.drawing = False
        # Default lowered (was 1.0) and ceiling capped at 2.5 (was 5.0) so the
        # slider can no longer be pushed into lag-inducing territory.
        self.speed = tk.DoubleVar(value=0.6)
        self.region_x = self.region_y = self.region_w = self.region_h = 0
        self.region_set = False

        keyboard.on_press_key(STOP_HOTKEY, lambda e: self.stop_drawing())

        self.setup_ui()

    def setup_ui(self):
        tk.Button(self.root, text="Load Image", command=self.load_image,
                  bg="#4a4a4a", fg="white", padx=10, font=("Segoe UI", 9, "bold")
                  ).pack(side=tk.LEFT, padx=5, pady=10)
        tk.Button(self.root, text="Select Area", command=self.select_area,
                  bg="#2d5a8a", fg="white", padx=10, font=("Segoe UI", 9, "bold")
                  ).pack(side=tk.LEFT, padx=5, pady=10)
        tk.Button(self.root, text="Draw", command=self.start_drawing,
                  bg="#2d7d2d", fg="white", padx=10, font=("Segoe UI", 9, "bold")
                  ).pack(side=tk.LEFT, padx=5, pady=10)
        tk.Button(self.root, text="Stop", command=self.stop_drawing,
                  bg="#7d2d2d", fg="white", padx=10, font=("Segoe UI", 9, "bold")
                  ).pack(side=tk.LEFT, padx=5, pady=10)
        tk.Label(self.root, text="Speed:", bg="#2c2c2c", fg="white",
                 font=("Segoe UI", 8)).pack(side=tk.LEFT, padx=(8, 2))
        tk.Scale(self.root, from_=0.1, to=2.5, resolution=0.1, orient=tk.HORIZONTAL,
                 variable=self.speed, bg="#2c2c2c", fg="white", length=90,
                 sliderlength=12, highlightthickness=0
                 ).pack(side=tk.LEFT)
        self.status = tk.Label(self.root,
                               text="Load image, select area, press Draw | ESC to stop",
                               bg="#2c2c2c", fg="#aaa", font=("Segoe UI", 8))
        self.status.pack(side=tk.LEFT, padx=8)

    def load_image(self):
        path = filedialog.askopenfilename(
            title="Select image",
            filetypes=[("Images", "*.png *.jpg *.jpeg *.bmp *.gif *.webp")])
        if not path:
            return
        try:
            self.img_original = cv2.imread(path)
            if self.img_original is None:
                raise ValueError("Could not load image")
            self.draw_paths = self.extract_contours(self.img_original)
            fn = path.split("/")[-1].split("\\")[-1]
            c = sum(len(p) for p in self.draw_paths)
            self.status.config(text=f"{fn} ({len(self.draw_paths)} strokes, {c} pts)", fg="#8f8")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def select_area(self):
        if self.img_original is None:
            messagebox.showinfo("Info", "Load an image first!")
            return
        self.region_set = False
        RegionSelector(self.root, self.on_region_selected)

    def on_region_selected(self, x, y, w, h):
        self.region_x, self.region_y, self.region_w, self.region_h = x, y, w, h
        self.region_set = True
        self.status.config(text=f"Area: ({x},{y}) {w}x{h}", fg="#ff8")

    def extract_contours(self, img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        edges = cv2.Canny(blurred, 25, 90)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_TC89_KCOS)
        if not contours:
            return []
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        paths = []
        for c in contours:
            area = cv2.contourArea(c)
            if area < 8:
                continue
            pts = c.squeeze(axis=1)
            if pts.ndim != 2 or len(pts) < 4:
                continue
            paths.append(pts.tolist())
        return paths

    def start_drawing(self):
        if self.img_original is None:
            messagebox.showinfo("Info", "Load an image first!")
            return
        if not self.region_set:
            messagebox.showinfo("Info", "Select an area to draw in!")
            return
        if self.drawing:
            return
        self.drawing = True
        self.do_countdown()

    def do_countdown(self):
        self.status.config(text="Drawing in 3...", fg="#f88")
        self.root.after(1000, lambda: self.status.config(text="Drawing in 2..."))
        self.root.after(2000, lambda: self.status.config(text="Drawing in 1..."))
        self.root.after(3000, self.start_draw_thread)

    def start_draw_thread(self):
        self.status.config(text="Drawing... (ESC to stop)", fg="#ff8")
        threading.Thread(target=self._draw_loop, daemon=True).start()

    def stop_drawing(self):
        if self.drawing:
            self.drawing = False
            pyautogui.mouseUp()
            self.root.after(0, lambda: self.status.config(text="Stopped by user", fg="#f88"))

    def _draw_loop(self):
        ih, iw = self.img_original.shape[:2]
        rw, rh = self.region_w, self.region_h
        img_aspect = iw / ih
        region_aspect = rw / rh
        if img_aspect > region_aspect:
            draw_w = rw
            draw_h = int(rw / img_aspect)
        else:
            draw_h = rh
            draw_w = int(rh * img_aspect)
        ox = self.region_x + (rw - draw_w) // 2
        oy = self.region_y + (rh - draw_h) // 2
        sx = draw_w / iw
        sy = draw_h / ih

        speed_val = self.speed.get()

        # --- Pacing, recalibrated for a calm, steady draw ---
        # base_dur slowed down (was 0.060) so each segment's movement takes
        # noticeably longer.
        base_dur = 0.09 / speed_val
        # min_dur raised from 0.001 to 0.008. This was the main cause of the
        # lag: at 0.001s, short segments produced near-instantaneous dragTo
        # calls back to back, flooding the system with synthetic input
        # events. 0.008s caps the event rate at ~125/sec, which still reads
        # as smooth motion but no longer overwhelms the OS input queue.
        min_dur = 0.008
        # xy_step capped between 2.0 and 6.0 regardless of speed, so high
        # speed settings can no longer shrink the step down to lag-inducing
        # sizes, and low speed settings don't get so sparse that the line
        # looks jumpy.
        xy_step = min(6.0, max(2.0, 3.0 / speed_val))
        # Slightly longer pause between strokes for a more natural feel.
        stroke_pause = max(0.05, 0.12 / speed_val)

        last_t = 0
        total_pts = sum(len(p) for p in self.draw_paths)
        drawn = 0

        for path in self.draw_paths:
            if not self.drawing:
                pyautogui.mouseUp()
                return
            if len(path) < 4:
                drawn += len(path)
                continue

            px0 = ox + path[0][0] * sx
            py0 = oy + path[0][1] * sy
            pyautogui.moveTo(px0, py0, duration=max(min_dur, base_dur))
            time.sleep(0.02)
            pyautogui.mouseDown()
            time.sleep(0.02)

            for i in range(1, len(path)):
                if not self.drawing:
                    pyautogui.mouseUp()
                    return
                x1 = ox + path[i - 1][0] * sx
                y1 = oy + path[i - 1][1] * sy
                x2 = ox + path[i][0] * sx
                y2 = oy + path[i][1] * sy
                interp = interpolate_line(x1, y1, x2, y2, xy_step)
                seg_len = math.hypot(x2 - x1, y2 - y1)
                point_dur = max(min_dur, base_dur * (seg_len / max(draw_w, draw_h)))
                for ix, iy in interp[1:]:
                    if not self.drawing:
                        pyautogui.mouseUp()
                        return
                    pyautogui.dragTo(ix, iy, duration=point_dur, button="left")
                    drawn += 1
                if not self.drawing:
                    pyautogui.mouseUp()
                    return

            pyautogui.mouseUp()
            time.sleep(stroke_pause)

            t = time.time()
            if t - last_t > 0.2:
                pct = min(99, int(drawn / total_pts * 100))
                self.root.after(0, lambda p=pct: self.status.config(
                    text=f"Drawing... {p}% (ESC to stop)", fg="#ff8"))
                last_t = t

        self.drawing = False
        self.root.after(0, lambda: self.status.config(text="Done!", fg="#8f8"))


if __name__ == "__main__":
    root = tk.Tk()
    AutoDraw(root)
    root.mainloop()