{{- define "goalixa-pwa.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: goalixa-pwa
{{- end }}
{{- define "goalixa-pwa.selectorLabels" -}}
app.kubernetes.io/name: pwa
{{- end }}
