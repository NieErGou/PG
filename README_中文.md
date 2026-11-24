# PG-MinGRU 四任务前端演示

本仓库提供可独立运行的 PG-MinGRU 前端，包含论文 version7 的四组对比结果、18 个 CPU 冻结演示模型，以及每个任务 16 条**确定性合成输入**。

## 启动

需要 Python 3.10 或更新版本。在本目录的 PowerShell 中执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

然后打开 <http://127.0.0.1:8765/>，或打开 <http://127.0.0.1:8765/runtime.html> 查看一键推理页面。完成依赖安装后，Windows 也可双击 `启动前端.bat`。Linux/macOS 命令见 [README.md](README.md)。

运行 `python verify_package.py` 可检查四个任务及全部 18 个模型的 HTTP 推理接口。本发布包在 Python 3.13、NumPy 2.4.3、PyTorch 2.10.0 CPU 环境验证通过；其他组合需在对应机器上复核。

## 数据与结果边界

波束分类展示 PG-MinGRU 和 7 个对比方法的 Top-1、Top-3、Top-5 准确率。MultimodalNF 可切换总体、NLoS 和由总体及 NLoS 加权反推的 LoS 结果。方向回归展示丰都与江南两场景的联合角度 MAE、RMSE 和指向达标帧数，对比方法为 EKF、GPR、Temporal-EKF、UFIR 和 WTFTP。对比数据来自论文使用的固定测试窗口。

`data/*/demo_samples.npz` 由 `generate_demo_data.py` 生成，合成输入仅用于检验推理接口。模型选择器列出可运行的冻结模型，来自往期对比的模型标记为历史演示。论文对比结果与推理演示在页面上分别展示。

DeepSense Scenario 23 和 MultimodalNF 原始数据请从数据拥有者处获取；MultimodalNF 未确认再分发许可。本包不含丰都、江南私有采集、逐样本预测、原始数据压缩包或测试标签。四个模型文件夹中的 `*_cpu_frozen.ts` 为演示推理所需的训练后模型。详细文件清单和 API 见 [README.md](README.md)。
