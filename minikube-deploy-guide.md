# 本地 minikube 部署前端应用（vuexy）全流程指南

---

## 0. 环境准备（Windows 下推荐）

### 0.1 安装 Scoop 包管理器

1. 打开 PowerShell（**普通用户权限**，不要用管理员模式）。
2. 执行：

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Invoke-RestMethod -Uri <https://get.scoop.sh> | Invoke-Expression

   ```


### 0.2 安装 kubectl

```powershell
scoop install kubectl
```

### 0.2.1 验证kubectl是否安装成功

```powershell
kubectl version
```

### 0.3 安装 minikube

```powershell
scoop install minikube
```

### 0.3.1 验证minikube是否安装成功

```powershell
minikube version
```

### 0.4 安装 Docker Desktop

- 官网下载：<https://www.docker.com/products/docker-desktop/>
- 安装后启动 Docker Desktop，建议用 WSL2 模式。

---

## 1. 启动 minikube 并配置 Docker 环境

```powershell
minikube start
minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

> 这样后续的 `docker` 命令会直接作用于 minikube 的 Docker 环境。

---

## 2. 构建前端镜像到 minikube

在你的前端项目目录下执行：

```powershell
docker build -t vuexy:latest .
```

> build 完后用 `docker images` 检查，`vuexy:latest` 的 CREATED 时间应为"刚刚"。

---

## 3. 编写 K8s 部署和服务 yaml

例如 `k8s.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vuexy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vuexy
  template:
    metadata:
      labels:
        app: vuexy
    spec:
      containers:
        - name: vuexy
          image: vuexy:latest
          imagePullPolicy: IfNotPresent   # 关键，优先用本地镜像
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: vuexy
spec:
  type: NodePort
  selector:
    app: vuexy
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

---

## 4. 部署到 K8s

```powershell
kubectl apply -f k8s.yaml
```

---

## 5. 检查 Pod 状态

```powershell
kubectl get pods
```

- 状态为 `Running` 即正常。

---

## 6. 获取访问地址

- 推荐命令：

  ```powershell
  minikube service vuexy
  ```

  会自动打开浏览器或显示访问地址。

- 或者手动拼接：

  ```powershell
  minikube ip
  ```

  假设输出 `192.168.49.2`，则访问：

  ```
  http://192.168.49.2:30080
  ```

---

## 7. 常见问题与解决

- **Pod 状态为 `ErrImagePull` 或 `ImagePullBackOff`：**
  - 必须在 minikube Docker 环境下 build 镜像。
  - yaml 里加 `imagePullPolicy: IfNotPresent`。
  - 镜像名和 tag 必须和 yaml 完全一致。

- **镜像 build 后 `CREATED` 时间不对：**
  - 说明没在 minikube 环境下 build，需重新执行 `minikube -p minikube docker-env --shell powershell | Invoke-Expression` 再 build。

- **访问不了页面：**
  - 检查 Pod 是否 Running，Service 是否有 NodePort，minikube ip 是否正确。

---

## 8. 其它建议

- 每次新开终端都要重新执行 `minikube -p minikube docker-env --shell powershell | Invoke-Expression`。
- 开发调试建议始终加 `imagePullPolicy: IfNotPresent`。

---

## 9. 使用 ArgoCD 实现 GitOps 持续部署

### 9.1 安装 ArgoCD

```powershell
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

等待几分钟，直到 argocd 相关 pod 状态为 Running：

```powershell
kubectl get pods -n argocd
```

---

### 9.2 启动 ArgoCD UI

ArgoCD 默认不会暴露外部端口。可以用端口转发方式访问 Web UI：

```powershell
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

然后在浏览器访问 http://localhost:8080

---

### 9.3 获取初始登录密码

初始用户名为 `admin`，密码需通过如下命令获取：

```powershell
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
```

将输出的 base64 字符串用 PowerShell 解码：

```powershell
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("上一步输出的字符串"))
```

---

### 9.4 登录 ArgoCD

- 用户名：admin
- 密码：上一步解码得到的密码
- 访问地址：http://localhost:8080

---

### 9.5 添加 Git 仓库

1. 进入 ArgoCD Web UI。
2. 左侧菜单点击 **Settings → Repositories**。
3. 点击 **Connect Repo using HTTPS/SSH**，填写你的 Git 仓库信息，点击 Connect。

---

### 9.6 创建 Application

1. 左侧点击 **Applications → NEW APP**。
2. 填写如下信息：
   - Application Name：自定义（如 vuexy）
   - Project：default
   - Repository URL：选择你刚才添加的 Git 仓库
   - Revision：分支名（如 main）
   - Path：k8s 配置文件所在目录（如 k8s 或 /）
   - Cluster：默认即可（https://kubernetes.default.svc）
   - Namespace：default
3. 点击 **Create**。

---

### 9.7 同步部署

- 进入 Application 页面，点击 **SYNC**，ArgoCD 会自动拉取 Git 仓库里的 yaml 并部署到 K8s。
- 可以在 UI 里看到 Pod、Service 等资源的状态。

---

### 9.8 访问你的前端服务

- 方式同前：`minikube service vuexy` 或 `minikube ip` + NodePort 端口。

---

### 9.9 常见问题

- **镜像拉取失败**：确保镜像已在 minikube Docker 环境下 build，yaml 里 `imagePullPolicy: IfNotPresent`。
- **Git 仓库变更不同步**：确认 Application 的 Sync Policy 设置，或手动点击 SYNC。

---

如需更详细的 ArgoCD 使用说明或遇到具体问题，欢迎随时提问！

---


