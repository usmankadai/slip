# Exploration 02: two schedules on one Gantt

Status: **decided on 11 November 2026: option C, only the difference, with the previous bar drawn in full for the selected activity.**

## Problem

The Gantt has to show this update and the previous one on the same rows, so a planner sees what moved without reading two charts. The usual answer is a second bar for the previous dates. Drawn for every activity it doubles the ink, and on a screen where most bars have not moved that second bar says nothing. The treatment also has to hold up in three awkward cases: a bar that moved by a day, which is less than a pixel at month zoom; a bar whose previous position is off the edge of the view; and an activity that has no previous position because it is new. And it must not lean on colour alone, since the canvas is invisible to assistive technology and the slip colours must survive colour-blind views.

## Options

All three are on one page over the same ten rows, with switches for zoom (weeks and months) and for colour-blind and greyscale views: [options.html](options.html). Run the `design` preview and open `/explorations/02-two-schedules-on-one-gantt/options.html`.

| Option | Does well | Does badly |
|---|---|---|
| **A. A thin bar underneath** | The baseline bar every P6 user knows; both updates readable off the axis | Doubles the marks, including on every activity that did not move; a one-day move looks like no move; the current bar gets thinner |
| **B. An outline behind** | Current bar keeps its height; nothing extra where nothing moved | The outline reads as an empty second activity; a duration that grew is hidden behind the bar; a one-day move is a hairline |
| **C. Only the difference** | Least ink, and all of it means something; a one-day move stays visible at any zoom; direction is carried by which side the tail is on | Not the convention, so it must be learned; the previous start is a tick and the previous duration is not drawn |

Things the mock made visible:

- B fails the most common real change. A duration that grows with the start unchanged leaves the outline entirely behind the bar.
- At month zoom A and B both lose small moves completely. Only C can keep them, because its mark is the move and can be given a minimum size. That minimum overstates a tiny move, which is a cost.
- None of the three marks a new activity. All rely on the absence of a ghost, which is easy to miss. That needs its own mark whichever is chosen.
- In C a critical activity that slipped has a warm tail beside a red hatched bar. They are close in hue; the hatch is doing the work there.
- The colour of an ordinary activity bar is not in the identity. A dark neutral was used so that warm and blue stay reserved for movement; that is a placeholder.

## Decision

**Option C, only the difference, with the previous bar drawn in full for the selected activity.** Chosen by Usman on 11 November 2026 ("C, your pick"), on Claude's recommendation and without reasons of his own. The reasoning is Claude's: C fits the identity, since colour appears only where a date moved and a warm mark always means late; and it is the only option that keeps a one-day move visible at month zoom. Drawing the old bar for the one selected row gives the exact previous dates on demand without adding noise to every other row.

A was rejected for doubling the marks on activities that did not move. B was rejected because a duration that grows with the start unchanged is hidden behind the bar.

Still open, and Usman's: how a new activity is marked on the chart (nothing marks it in this version; the grid's "What changed" column says Added), and the colour of an ordinary bar (a dark neutral, as drawn).

## What changed

Nothing yet.
