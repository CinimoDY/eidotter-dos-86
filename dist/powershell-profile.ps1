# eiDotter DOS-86: PSReadLine colours. Dot-source this file from $PROFILE.
Set-PSReadLineOption -Colors @{
  Default = "$([char]27)[38;2;255;176;0m"
  Command = "$([char]27)[38;2;253;202;159m"
  Parameter = "$([char]27)[38;2;184;124;26m"
  Operator = "$([char]27)[38;2;184;124;26m"
  String = "$([char]27)[38;2;253;202;159m"
  Number = "$([char]27)[38;2;253;202;159m"
  Variable = "$([char]27)[38;2;253;202;159m"
  Keyword = "$([char]27)[38;2;255;176;0m"
  Type = "$([char]27)[38;2;255;176;0m"
  Member = "$([char]27)[38;2;255;176;0m"
  Comment = "$([char]27)[38;2;184;124;26m"
  ContinuationPrompt = "$([char]27)[38;2;184;124;26m"
  InlinePrediction = "$([char]27)[38;2;154;87;0m"
  Emphasis = "$([char]27)[38;2;255;255;85m"
  Error = "$([char]27)[38;2;255;85;85m"
}
