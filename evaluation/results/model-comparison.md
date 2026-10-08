# Forecast model comparison

Dataset `ds-b8c87480e064`: 38,351 training rows and 9,813 test rows from 2,400 / 600 simulation runs (split by run). Engine 1.0.0, model version `forecast-20261004-160112`.

| Target | Model | MAE | RMSE | R² | Fit time (s) | Selected |
| --- | --- | --- | --- | --- | --- | --- |
| revenue | persistence (reference) | ₹224,167 | ₹985,346 | 0.9666 | 0.0 |  |
| revenue | linear_regression | ₹144,068 | ₹588,542 | 0.9881 | 0.0 |  |
| revenue | random_forest | ₹114,933 | ₹525,715 | 0.9905 | 5.0 | ✓ |
| revenue | xgboost | ₹143,540 | ₹798,497 | 0.9780 | 0.7 |  |
| customers | persistence (reference) | 956.8 | 5,230.7 | 0.9677 | 0.0 |  |
| customers | linear_regression | 583.8 | 2,858.0 | 0.9903 | 0.0 |  |
| customers | random_forest | 446.7 | 2,504.2 | 0.9926 | 4.6 | ✓ |
| customers | xgboost | 576.8 | 3,795.5 | 0.9830 | 0.7 |  |
| churnRate | persistence (reference) | 0.0197 | 0.0489 | 0.7084 | 0.0 |  |
| churnRate | linear_regression | 0.0637 | 0.0836 | 0.1487 | 0.0 |  |
| churnRate | random_forest | 0.0106 | 0.0179 | 0.9611 | 4.3 |  |
| churnRate | xgboost | 0.0106 | 0.0175 | 0.9625 | 0.6 | ✓ |

Revenue errors are in rupees; churnRate is a monthly fraction. The persistence row is a
reference, not a candidate: it predicts that next month equals this month.
