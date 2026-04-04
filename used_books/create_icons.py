"""
创建科技感风格的 tabbar 图标
"""
from PIL import Image, ImageDraw

def create_icon(name, draw_func, size=81, color=(107, 114, 128), line_width=3):
    """创建图标的基础函数"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, size, color, line_width)
    img.save(f'{name}.png')
    print(f'Created {name}.png')

def create_icon_selected(name, draw_func, size=81, color=(0, 212, 255), line_width=3):
    """创建选中状态的图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, size, color, line_width)
    img.save(f'{name}.png')
    print(f'Created {name}.png')

# 首页图标 - 房子
def draw_home(draw, size, color, line_width):
    s = size
    # 房顶三角形
    draw.polygon([
        (s//2, s//6),      # 顶点
        (s//8, s//2),      # 左下
        (s - s//8, s//2)   # 右下
    ], outline=color, width=line_width)
    # 房身
    draw.rectangle([s//5, s//2, s - s//5, s - s//8], outline=color, width=line_width)
    # 门
    door_width = s//5
    door_height = s//4
    draw.rectangle([
        s//2 - door_width//2, 
        s - s//8 - door_height,
        s//2 + door_width//2,
        s - s//8
    ], outline=color, width=line_width)

# 发布图标 - 加号
def draw_publish(draw, size, color, line_width):
    s = size
    margin = s // 5
    # 外圆
    draw.ellipse([margin, margin, s - margin, s - margin], outline=color, width=line_width)
    # 加号横线
    draw.line([(s//3, s//2), (s - s//3, s//2)], fill=color, width=line_width)
    # 加号竖线
    draw.line([(s//2, s//3), (s//2, s - s//3)], fill=color, width=line_width)

# 我的图标 - 用户
def draw_my(draw, size, color, line_width):
    s = size
    # 头部圆形
    head_radius = s // 6
    head_center = s // 2
    head_top = s // 5
    draw.ellipse([
        head_center - head_radius,
        head_top,
        head_center + head_radius,
        head_top + head_radius * 2
    ], outline=color, width=line_width)
    # 身体弧线
    body_top = head_top + head_radius * 2 + s // 12
    body_bottom = s - s // 6
    body_width = s // 3
    draw.arc([
        head_center - body_width,
        body_top,
        head_center + body_width,
        body_bottom + body_width
    ], start=220, end=320, fill=color, width=line_width)

# 创建所有图标
tabbar_path = r'E:\codeProject\wx_small_project\used_books\miniprogram\images\tabbar'
import os
os.chdir(tabbar_path)

# 灰色 - 未选中
gray = (107, 114, 128, 255)
# 青色 - 选中
cyan = (0, 212, 255, 255)

# 创建首页图标
create_icon('home', draw_home, color=gray)
create_icon_selected('home_on', draw_home, color=cyan)

# 创建发布图标
create_icon('publish', draw_publish, color=gray)
create_icon_selected('publish_on', draw_publish, color=cyan)

# 创建我的图标
create_icon('my', draw_my, color=gray)
create_icon_selected('my_on', draw_my, color=cyan)

print('\nAll icons created successfully!')
