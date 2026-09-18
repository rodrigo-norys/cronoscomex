# Medicao de referencia — os numeros que a aplicacao apresenta

**Medido em:** 2026-09-17T23:38:53.822Z
**Processos carregados:** 650

> Gerado por `tools/medir-numeros.mjs`. Toda string foi substituida por
> `<texto>` e todo array pela contagem dele — regra inviolavel 8.

> **`ALE-06` e a Pagina Historico NAO sao medidos aqui, e o zero deles e
> artefato.** O historico vai para diretorio temporario, entao a serie chega
> vazia: `processos_parados` sai `0` e `stalledMeasurable` sai `false` por
> CONSTRUCAO, nunca por medicao. Quem precisar deles passa um `historyPath`
> real a `carregarPlanilha()` — e aceita que a medicao grava no estado do
> operador. Ler esse zero como fato e o que a regra inviolavel 3 proibe.

## `GET /api/health` — 200

```json
{
 "state": "<texto>",
 "workbookPath": "<texto>",
 "sheetName": "<texto>",
 "lastReadAt": "<texto>",
 "lastReadOk": true,
 "lastReadDurationMs": 58,
 "sourceFileHash": "<texto>",
 "rowsRead": 650,
 "rowsAccepted": 650,
 "rowsQuarantined": 0,
 "pendingEditsCount": 0,
 "degradedReason": null,
 "schemaDivergences": {
  "_itens": 0,
  "_forma": null
 },
 "externalLock": false,
 "conflictFiles": {
  "_itens": 0,
  "_forma": null
 },
 "today": "<texto>"
}
```

## `GET /api/indicators` — 200

```json
{
 "counts": {
  "total": 650,
  "emAndamento": 103,
  "emDesembaraco": 33,
  "desembaracados": 480,
  "fechadoAguardandoDraft": 34,
  "chegandoHoje": 0,
  "chegandoSemana": 0,
  "chegando15Dias": 0,
  "canalVermelho": 5,
  "documentosPendentes": 72,
  "atrasados": 105,
  "desembaracadosHoje": 0,
  "desembaracadosNoPeriodo": 480
 },
 "channelDistribution": {
  "verde": 477,
  "vermelho": 5,
  "indefinido": 168,
  "known": 482,
  "verdeShare": 0.9896265560165975,
  "vermelhoShare": 0.01037344398340249
 },
 "rankings": {
  "clients": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 384,
    "segments": {
     "_itens": 4,
     "_forma": {
      "key": "<texto>",
      "label": "<texto>",
      "count": 304
     }
    }
   }
  },
  "importers": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 77
   }
  },
  "agents": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 246,
    "overdueCount": 55
   }
  },
  "goods": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 210
   }
  },
  "responsible": {
   "_itens": 3,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 357
   }
  }
 },
 "expectedVessels": {
  "_itens": 0,
  "_forma": null
 },
 "arrivalCalendar": {
  "_itens": 0,
  "_forma": null
 },
 "documentaryLeadTime": {
  "averageDays": 12.5,
  "sampleSize": 101,
  "excludedNegative": 1,
  "excludedIncomplete": 548
 },
 "leadTimeByGroup": {
  "clients": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 304,
    "averageDays": 14.2,
    "sampleSize": 63,
    "excludedNegative": 1,
    "excludedIncomplete": 240
   }
  },
  "agents": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 246,
    "averageDays": 15.3,
    "sampleSize": 36,
    "excludedNegative": 1,
    "excludedIncomplete": 209
   }
  },
  "vessels": {
   "_itens": 10,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 19,
    "averageDays": 10.9,
    "sampleSize": 12,
    "excludedNegative": 0,
    "excludedIncomplete": 7
   }
  },
  "responsible": {
   "_itens": 3,
   "_forma": {
    "key": "<texto>",
    "label": "<texto>",
    "count": 357,
    "averageDays": 14.7,
    "sampleSize": 57,
    "excludedNegative": 1,
    "excludedIncomplete": 299
   }
  },
  "groupTotals": {
   "clients": 134,
   "agents": 35,
   "vessels": 70,
   "responsible": 3
  }
 },
 "meta": {
  "today": "<texto>",
  "timezone": "<texto>",
  "weekEnd": "<texto>",
  "topN": 10,
  "bazarShare": 0.3547,
  "period": {
   "from": null,
   "to": null
  },
  "dataRange": {
   "eta2": {
    "from": "<texto>",
    "to": "<texto>",
    "missing": 65
   },
   "registration": {
    "from": "<texto>",
    "to": "<texto>",
    "missing": 167
   }
  }
 }
}
```

## `GET /api/alerts` — 200

```json
{
 "items": {
  "_itens": 179,
  "_forma": {
   "type": "<texto>",
   "severity": 1,
   "ref": "<texto>",
   "sourceRow": 23,
   "eta2": "<texto>",
   "daysOverdue": 260,
   "message": "<texto>"
  }
 },
 "countsByType": {
  "eta_vencida": 105,
  "canal_vermelho": 2,
  "documentacao_pendente": 72,
  "processos_parados": 0,
  "chegadas_hoje": 0,
  "chegadas_7_dias": 0
 },
 "stalledThresholdDays": 15,
 "historyStartedAt": null,
 "stalledCoverageDays": null,
 "stalledMeasurable": false
}
```

## `GET /api/quarantine` — 200

```json
{
 "generatedAt": "<texto>",
 "sourceFileHash": "<texto>",
 "totalDataRows": 650,
 "acceptedRows": 650,
 "quarantinedRows": 0,
 "quarantineRate": 0,
 "items": {
  "_itens": 0,
  "_forma": null
 },
 "anomalies": {
  "_itens": 5,
  "_forma": {
   "sourceRow": 23,
   "ref": "<texto>",
   "code": "<texto>",
   "detail": "<texto>"
  }
 }
}
```

## `GET /api/processes` — 200

```json
{
 "items": {
  "_itens": 200,
  "_forma": {
   "ref": "<texto>",
   "sourceRow": 2,
   "client": "<texto>",
   "clientProcess": "<texto>",
   "importer": "<texto>",
   "billOfLading": "<texto>",
   "agent": "<texto>",
   "container": "<texto>",
   "vessel": "<texto>",
   "port": "<texto>",
   "goods": "<texto>",
   "eta2": "<texto>",
   "registrationDate": "<texto>",
   "docsSentDate": null,
   "statusRaw": "<texto>",
   "statusCategory": "<texto>",
   "responsible": "<texto>",
   "responsibleLabel": "<texto>",
   "colorResponsible": "<texto>",
   "customsChannel": "<texto>",
   "importerOutsideRj": false,
   "boletoRaw": "<texto>",
   "paymentRaw": "<texto>",
   "columnPRaw": "<texto>",
   "anomalies": {
    "_itens": 0,
    "_forma": null
   },
   "fills": {
    "A": "<texto>",
    "B": "<texto>",
    "C": "<texto>",
    "D": "<texto>",
    "E": "<texto>",
    "F": "<texto>",
    "G": "<texto>",
    "H": "<texto>",
    "I": "<texto>",
    "J": "<texto>",
    "K": "<texto>",
    "L": "<texto>",
    "M": "<texto>",
    "N": "<texto>"
   },
   "hasPendingEdits": false
  }
 },
 "total": 650,
 "limit": 200,
 "offset": 0,
 "headerLabels": {
  "A": "<texto>",
  "B": "<texto>",
  "C": "<texto>",
  "D": "<texto>",
  "E": "<texto>",
  "F": "<texto>",
  "G": "<texto>",
  "H": "<texto>",
  "I": "<texto>",
  "J": "<texto>",
  "K": "<texto>",
  "L": "<texto>",
  "M": "<texto>",
  "N": "<texto>",
  "O": "<texto>",
  "P": "<texto>"
 }
}
```

## `GET /api/history/monthly` — 200

```json
{
 "series": {
  "_itens": 0,
  "_forma": null
 },
 "reconstructed": {
  "points": {
   "_itens": 10,
   "_forma": {
    "month": "<texto>",
    "chegados": 15,
    "desembaracados": 0,
    "forecast": false
   }
  },
  "missingEta2": 65,
  "missingRegistration": 167
 },
 "historyStartedAt": null,
 "truncated": false
}
```

## `GET /api/clients` — 200

```json
{
 "items": {
  "_itens": 509,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 26,
   "samples": {
    "_itens": 3,
    "_forma": "<texto>"
   },
   "client": null,
   "parent": null
  }
 },
 "declared": {
  "_itens": 0,
  "_forma": null
 },
 "total": 509,
 "names": {
  "_itens": 0,
  "_forma": null
 }
}
```

## `GET /api/team` — 200

```json
{
 "members": {
  "_itens": 0,
  "_forma": null
 },
 "unassigned": {
  "_itens": 25,
  "_forma": {
   "key": "<texto>",
   "count": 77
  }
 },
 "nextKey": "<texto>",
 "blankImporters": 36
}
```

## `GET /api/filters/options` — 200

```json
{
 "clients": {
  "_itens": 134,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 38
  }
 },
 "clientGroups": {
  "_itens": 0,
  "_forma": null
 },
 "clientProcesses": {
  "_itens": 510,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 38
  }
 },
 "importers": {
  "_itens": 26,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 36
  }
 },
 "vessels": {
  "_itens": 70,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 65
  }
 },
 "agents": {
  "_itens": 35,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 74
  }
 },
 "goods": {
  "_itens": 217,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 58
  }
 },
 "ports": {
  "_itens": 6,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 43
  }
 },
 "categories": {
  "_itens": 4,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 103
  }
 },
 "responsible": {
  "_itens": 1,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 91
  }
 },
 "colorResponsible": {
  "_itens": 4,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 120
  }
 },
 "channels": {
  "_itens": 3,
  "_forma": {
   "key": "<texto>",
   "label": "<texto>",
   "count": 477
  }
 }
}
```

---

**Custo desta medicao:** 0.1s de execucao.
