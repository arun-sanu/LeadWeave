{{- define "leadweave.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "leadweave.fullname" -}}
{{- if contains .Chart.Name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "leadweave.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "leadweave.labels" -}}
helm.sh/chart: {{ include "leadweave.chart" . }}
{{ include "leadweave.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "leadweave.selectorLabels" -}}
app.kubernetes.io/name: {{ include "leadweave.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "leadweave.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "leadweave.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "leadweave.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- include "leadweave.fullname" . }}
{{- end }}
{{- end }}
