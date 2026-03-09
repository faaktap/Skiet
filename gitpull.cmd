@echo off
echo https://www.freecodecamp.org/news/git-pull-explained/
echo Check if The local repository has a linked remote repository
git remote -v
pause
echo Check the status
git status
pause
echo we should really look at rebase and new branches to keep it clean
echo https://www.freecodecamp.org/news/how-to-use-git-rebase/

echo ------------------
echo start with git checkout -b foo
echo then you work and commit to that branch (foo)
echo then ....
echo git checkout main
echo git pull
echo git checkout foo
echo git rebase main
echo Regularly fetch and rebase your local branches to stay up-to-date with the main branch. Conflicts become messy! Rebase early and often.