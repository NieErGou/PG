# PG-MinGRU 四任务前端演示

这个文件夹可独立复制或上传到 GitHub。包含完整前端页面、本地 Python 服务、18 个 CPU 冻结模型、四任务已报告结果的汇总快照，以及每个任务 16 条**确定性合成输入**。克隆后不需要原 `new_mnet` 工程目录即可启动。

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

`data/*/demo_samples.npz` 由 `generate_demo_data.py` 生成，只有准备好的合成特征，没有原始采集记录或真值。它们可用于演示前端和模型接口，**不能复算界面上的准确率或误差**。`results.json`、`comparison.csv` 和结果图是原工程已报告实验的汇总快照，测试集不是新的盲测。DOA 展示的模型集合在查看测试结果后确定，权重选择使用验证集。页面所列 CPU 时延来自原 Windows 测试，不是下载者设备或 Jetson 的实测值。

DeepSense Scenario 23 和 MultimodalNF 原始数据请从数据拥有者处获取；MultimodalNF 未确认再分发许可。本包不含丰都、江南私有采集、逐样本预测、原始数据压缩包或测试标签。四个模型文件夹中的 `*_cpu_frozen.ts` 为演示推理所需的训练后模型。详细文件清单和 API 见 [README.md](README.md)。
