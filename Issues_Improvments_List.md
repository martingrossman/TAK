**Process Improvements**

| Process<br>Number | Description|
|:--|:--|
|PRC1|Minimize token usage by doin tests locally|
|PRC2|Review and update current Agents.md and other instructions for coding|
|PRC3| Update readme so its updated wit code, setup, etc.|

**Issues table**

| Issue<br>Number | Description|
|:--|:--|
|ISS1|**Done (2026-11-01):** Existing issues now open in the compact editor. More options opens the full details view.|
|ISS2|**Done (2026-11-01):** Gantt "weeks" view still shows individual day columns; it only compresses them and extends the scrollable date range, so it looks almost the same as "days" while task labels become clipped. Make the week scale visually distinct and clarify that the date range above the chart covers the full scrollable timeline. Preserve task dates and drag/resize behavior.|
|ISS3|**Done (2026-11-01):** Sheet keyboard navigation scrolls horizontally and vertically to keep the focused cell visible around the pinned column and sticky header. Verified locally and in Apps Script; commit `3608c99`.|


**Improvement table**

| Improvement<br>Number | Description                      |
| :-- | :-- |
| IM1| Rename Sheet view to List view ? |
| IM2| Direct writing comments, assignment, description without need opening details|
| IM3 | Let a user copy their current local demo issues into a separate test Google Sheet so both modes show the same test data. Preserve issue IDs, hierarchy, assignees, labels and dates; preview differences and protect existing Sheet data. This is a one-time test-data transfer, not automatic synchronization. |
| IM4|**Done (2026-11-01):** Getting started help describes shortcuts for view switching, search, new issue, the command palette and Escape.|
| IM5|  remove from dashboards and compact dialogs unnecessary info like issue number, etc. It should not be cluttered with unused info|
| IM6| in Sheet there is twice name displayed, once in left column with id and once in summary column.[[issue_sheet_twice_names.png]]
| IM7| Have button to expland all simmlanes and back contract|   
| IM8| Each memebr holidays can be viewed optionaly along the gant view so its clear who is when free or busy|
| IM9 | Peoples calendars should be optionaly connected to google claendars, i have already a prposal for code for this, we should use that|

